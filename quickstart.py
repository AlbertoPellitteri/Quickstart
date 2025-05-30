import argparse
import io
import os
import signal
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from io import BytesIO
from threading import Thread

import namesgenerator
import requests
from PIL import Image
from cachelib.file import FileSystemCache
from dotenv import load_dotenv
from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    send_file,
    send_from_directory,
)
from waitress import serve
from werkzeug.utils import secure_filename

from flask_session import Session
from modules import validations, output, persistence, helpers, database

load_dotenv(os.path.join(helpers.CONFIG_DIR, ".env"), override=True)

UPLOAD_FOLDER = os.path.join(helpers.CONFIG_DIR, "uploads")
UPLOAD_FOLDER_MOVIE = os.path.join(UPLOAD_FOLDER, "movies")
UPLOAD_FOLDER_SHOW = os.path.join(UPLOAD_FOLDER, "shows")
os.makedirs(UPLOAD_FOLDER_MOVIE, exist_ok=True)
os.makedirs(UPLOAD_FOLDER_SHOW, exist_ok=True)
IMAGES_FOLDER = os.path.join(helpers.MEIPASS_DIR, "static", "images")
OVERLAY_FOLDER = os.path.join(IMAGES_FOLDER, "overlays")
PREVIEW_FOLDER = os.path.join(helpers.CONFIG_DIR, "previews")
os.makedirs(PREVIEW_FOLDER, exist_ok=True)

GITHUB_MASTER_VERSION_URL = "https://raw.githubusercontent.com/Kometa-Team/Quickstart/master/VERSION"
GITHUB_DEVELOP_VERSION_URL = "https://raw.githubusercontent.com/Kometa-Team/Quickstart/develop/VERSION"

basedir = os.path.abspath

app = Flask(__name__)

# Run version check at startup
app.config["VERSION_CHECK"] = helpers.check_for_update()


def start_update_thread():
    """Ensure update_checker_loop runs inside the Flask app context."""
    with app.app_context():
        while True:
            app.config["VERSION_CHECK"] = helpers.check_for_update()
            time.sleep(86400)  # Sleep for 24 hours


# Start the background version checker safely
threading.Thread(target=start_update_thread, daemon=True).start()


@app.context_processor
def inject_version_info():
    """Ensure latest version info is injected dynamically in templates"""
    return {"version_info": helpers.check_for_update()}


# Use booler() for FLASK_DEBUG conversion
app.config["QS_DEBUG"] = helpers.booler(os.getenv("QS_DEBUG", "0"))
app.config["QUICKSTART_DOCKER"] = helpers.booler(os.getenv("QUICKSTART_DOCKER", "0"))

app.config["SESSION_TYPE"] = "cachelib"
app.config["SESSION_CACHELIB"] = FileSystemCache(cache_dir="flask_session", threshold=500)
app.config["SESSION_PERMANENT"] = True
app.config["SESSION_USE_SIGNER"] = False

server_session = Session(app)
server_thread = None

# Ensure json-schema files are up to date at startup
helpers.ensure_json_schema()

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif", "bmp"}

parser = argparse.ArgumentParser(description="Run Quickstart Flask App")
parser.add_argument("--port", type=int, help="Specify the port number to run the server")
parser.add_argument("--debug", action="store_true", help="Enable debug mode")
args = parser.parse_args()

port = args.port if args.port else int(os.getenv("QS_PORT", "7171"))
running_port = port
debug_mode = args.debug if args.debug else helpers.booler(os.getenv("QS_DEBUG", "0"))

print(f"[INFO] Running on port: {port} | Debug Mode: {'Enabled' if debug_mode else 'Disabled'}")


@app.route("/rename_library_image", methods=["POST"])
def rename_library_image():
    data = request.json
    old_name = data.get("old_name")
    new_name = data.get("new_name")
    image_type = data.get("type")  # "movie" or "show"

    if not old_name or not new_name or image_type not in ["movie", "show"]:
        return jsonify({"status": "error", "message": "Invalid parameters"}), 400

    save_folder = UPLOAD_FOLDER_MOVIE if image_type == "movie" else UPLOAD_FOLDER_SHOW
    old_path = os.path.join(save_folder, old_name)

    # Ensure old file exists
    if not os.path.exists(old_path):
        return jsonify({"status": "error", "message": "File not found"}), 404

    # Extract original extension
    old_ext = os.path.splitext(old_name)[1]  # e.g., ".jpg"

    # Ensure new name has correct extension
    if "." not in new_name:  # No extension provided
        new_name += old_ext  # Append original extension
    elif not new_name.endswith(old_ext):  # Wrong extension provided
        new_name += old_ext  # Append original extension

    new_path = os.path.join(save_folder, new_name)

    # Check if the new file name already exists
    if os.path.exists(new_path):
        return (
            jsonify({"status": "error", "message": "File with new name already exists"}),
            400,
        )

    try:
        os.rename(old_path, new_path)
        return jsonify({"status": "success", "message": "File renamed successfully"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/config/uploads/<path:filename>")
def serve_uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route("/config/previews/<path:filename>")
def serve_previews(filename):
    return send_from_directory(PREVIEW_FOLDER, filename)


@app.route("/generate_preview", methods=["POST"])
def generate_preview():
    data = request.json
    overlays = data.get("overlays", [])
    img_type = data.get("type", "movie")  # "movie" or "show"
    selected_image = data.get("selected_image", "default.png")
    library_id = data.get("library_id", "default-library")  # Unique identifier for each library
    upload_folder = UPLOAD_FOLDER_MOVIE if img_type == "movie" else UPLOAD_FOLDER_SHOW

    if app.config["QS_DEBUG"]:
        print(f"[DEBUG] Generating preview for {library_id}, Type: {img_type}, Overlays: {overlays}")

    # Ensure preview directory exists
    if not os.path.exists(PREVIEW_FOLDER):
        os.makedirs(PREVIEW_FOLDER)

    # Generate a unique preview filename per library
    preview_filename = f"{library_id}-{img_type}_preview.png"
    preview_filepath = os.path.join(PREVIEW_FOLDER, preview_filename)

    # First, check if `default.png` exists in `IMAGES_FOLDER`
    default_image_path = os.path.join(IMAGES_FOLDER, "default.png")

    if not selected_image or selected_image == "default":
        if os.path.exists(default_image_path):
            base_image_path = default_image_path  # Use existing `default.png`
        else:
            base_image_path = os.path.join(PREVIEW_FOLDER, "default.png")

            # Only create grey image if both locations are missing.
            if not os.path.exists(base_image_path):
                if app.config["QS_DEBUG"]:
                    print("[DEBUG] default.png not found in IMAGES_FOLDER or previews, creating grey placeholder image...")

                base_img = Image.new("RGBA", (1000, 1500), (128, 128, 128, 255))  # grey
                base_img.save(base_image_path)
    else:
        base_image_path = os.path.join(upload_folder, selected_image)

    if not os.path.exists(base_image_path):
        return jsonify({"status": "error", "message": "Selected image not found."}), 400

    base_img = Image.open(base_image_path).convert("RGBA")

    # Ensure base image is 1000x1500
    base_img = base_img.resize((1000, 1500), Image.LANCZOS)  # noqa

    # Apply overlays
    for overlay in overlays:
        overlay_path = os.path.join(OVERLAY_FOLDER, f"{overlay}.png")
        if os.path.exists(overlay_path):
            overlay_img = Image.open(overlay_path).convert("RGBA")
            base_img.paste(overlay_img, (0, 0), overlay_img)

    # Save the generated preview
    base_img.save(preview_filepath)

    if app.config["QS_DEBUG"]:
        print(f"[DEBUG] Preview saved at {preview_filepath}")

    return jsonify({"status": "success", "preview_url": f"/{preview_filepath}"})


@app.route("/config/previews/<filename>")
def serve_preview_image(filename):
    """
    Serves the requested preview image. If not found, returns a default placeholder.
    """
    filepath = os.path.join(PREVIEW_FOLDER, filename)

    if os.path.exists(filepath):
        return send_file(filepath, mimetype="image/png")
    else:
        print(f"[WARNING] Requested preview image '{filename}' not found. Returning default.")
        return send_file(os.path.join(IMAGES_FOLDER, "default.png"), mimetype="image/png")


@app.route("/get_preview_image/<img_type>", methods=["GET"])
def get_preview_image(img_type):
    preview_filename = f"{img_type}_preview.png"
    preview_path = os.path.join(PREVIEW_FOLDER, preview_filename)

    # Generate preview if it doesn't exist
    if not os.path.exists(preview_path):
        print(f"[WARNING] Preview not found for {img_type}. Generating...")
        generate_preview()

    if os.path.exists(preview_path):
        return send_file(preview_path, mimetype="image/png")

    return jsonify({"status": "error", "message": "Preview image not found"}), 400


@app.route("/list_uploaded_images", methods=["GET"])
def list_uploaded_images():
    image_type = request.args.get("type")  # Expecting "movie" or "show"

    if image_type not in ["movie", "show"]:
        return jsonify({"status": "error", "message": "Invalid image type"}), 400

    # Ensure the correct directory is used
    uploads_dir = UPLOAD_FOLDER_MOVIE if image_type == "movie" else UPLOAD_FOLDER_SHOW

    if not os.path.exists(uploads_dir):
        return jsonify({"images": []})  # Return empty list if folder doesn't exist

    images = [img for img in os.listdir(uploads_dir) if img.lower().endswith((".png", ".jpg", ".jpeg"))]

    return jsonify({"images": images})


@app.route("/upload_library_image", methods=["POST"])
def upload_library_image():
    if "image" not in request.files:
        return jsonify({"status": "error", "message": "No image uploaded"}), 400
    image = request.files["image"]

    image_type = request.form.get("type")  # "movie" or "show"

    if not image or not image_type or image_type not in ["movie", "show"]:
        return (
            jsonify({"status": "error", "message": "Invalid request parameters"}),
            400,
        )

    # Validate file extension
    filename = secure_filename(image.filename)
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Invalid file type. Allowed: png, jpg, jpeg, webp",
                }
            ),
            400,
        )

    # Open and validate image
    img = Image.open(image)  # noqa
    if not helpers.is_valid_aspect_ratio(img):
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Image must have a 1:1.5 aspect ratio (e.g., 1000x1500).",
                }
            ),
            400,
        )

    # Resize if needed
    img = img.resize((1000, 1500), Image.LANCZOS)  # noqa

    # Set save directory
    save_folder = UPLOAD_FOLDER_MOVIE if image_type == "movie" else UPLOAD_FOLDER_SHOW
    os.makedirs(save_folder, exist_ok=True)

    # Set initial save path **before the loop**
    save_path = os.path.join(save_folder, filename)

    # Prevent overwriting existing files
    base, ext = os.path.splitext(filename)
    counter = 1
    while os.path.exists(os.path.join(save_folder, filename)):
        filename = f"{base}_{counter}{ext}"
        save_path = os.path.join(save_folder, filename)
        counter += 1

    # Save the validated and resized image
    img.save(save_path)

    return jsonify(
        {
            "status": "success",
            "message": f"Image uploaded and saved as {filename}",
            "filename": filename,
        }
    )


@app.route("/fetch_library_image", methods=["POST"])
def fetch_library_image():
    data = request.json
    image_url = data.get("url")
    image_type = data.get("type")  # "movie" or "show"

    if not image_url or not image_type or image_type not in ["movie", "show"]:
        return (
            jsonify({"status": "error", "message": "Invalid request parameters"}),
            400,
        )

    try:
        response = requests.get(image_url, stream=True, timeout=5)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))

        # Validate file extension
        file_extension = img.format.lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Invalid file type. Allowed: png, jpg, jpeg, webp",
                    }
                ),
                400,
            )

        # Ensure the correct aspect ratio
        if not helpers.is_valid_aspect_ratio(img):
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Image must have a 1:1.5 aspect ratio (e.g., 1000x1500).",
                    }
                ),
                400,
            )

        # Resize if necessary
        img = img.resize((1000, 1500), Image.LANCZOS)  # noqa

        # Set save directory
        save_folder = UPLOAD_FOLDER_MOVIE if image_type == "movie" else UPLOAD_FOLDER_SHOW
        os.makedirs(save_folder, exist_ok=True)

        # Generate a safe filename from URL
        filename = secure_filename(os.path.basename(image_url))
        if "." not in filename or filename.split(".")[-1].lower() not in ALLOWED_EXTENSIONS:
            filename += ".png"  # Default to PNG if no valid extension is found

        # Set initial save path **before the loop**
        save_path = os.path.join(save_folder, filename)

        # Prevent overwriting existing files
        base, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(save_path):
            filename = f"{base}_{counter}{ext}"
            save_path = os.path.join(save_folder, filename)
            counter += 1

        # Save the validated and resized image
        img.save(save_path)

        return jsonify(
            {
                "status": "success",
                "message": f"Image fetched and saved as {filename}",
                "filename": filename,
            }
        )

    except requests.exceptions.RequestException as e:
        return (
            jsonify({"status": "error", "message": f"Failed to fetch image: {str(e)}"}),
            400,
        )
    except Exception as e:
        return (
            jsonify({"status": "error", "message": f"Processing error: {str(e)}"}),
            400,
        )


@app.route("/delete_library_image/<filename>", methods=["DELETE"])
def delete_library_image(filename):
    image_type = request.args.get("type")  # "movie" or "show"

    if image_type not in ["movie", "show"]:
        return jsonify({"status": "error", "message": "Invalid image type"}), 400

    uploads_dir = UPLOAD_FOLDER_MOVIE if image_type == "movie" else UPLOAD_FOLDER_SHOW
    file_path = os.path.join(uploads_dir, filename)

    if not os.path.exists(file_path):
        return jsonify({"status": "error", "message": "File not found"}), 404

    try:
        os.remove(file_path)
        return jsonify({"status": "success", "message": f"Deleted {filename}"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/update_libraries", methods=["POST"])
def update_libraries():
    try:
        data = request.get_json()
        app.logger.info("Received data: %s", data)  # Log the received data
        return jsonify({"status": "success"})
    except Exception as e:
        app.logger.error("Error updating libraries: %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/")
def start():
    return redirect(url_for("step", name="001-start"))


@app.route("/clear_session", methods=["POST"])
def clear_session():
    data = request.values
    try:
        config_name = data["name"]
        if config_name != session["config_name"]:
            session["config_name"] = config_name
    except KeyError:  # Handle missing `name` key safely
        config_name = session.get("config_name")

    persistence.flush_session_storage(config_name)

    # Send message to toast
    return jsonify(
        {
            "status": "success",
            "message": f"Session storage cleared for '{config_name}'.",
        }
    )


@app.route("/clear_data/<name>/<section>")
def clear_data_section(name, section):
    database.reset_data(name, section)
    flash("SQLite storage cleared successfully.", "success")
    return redirect(url_for("start"))


@app.route("/clear_data/<name>")
def clear_data(name):
    database.reset_data(name)
    flash("SQLite storage cleared successfully.", "success")
    return redirect(url_for("start"))


@app.route("/step/<name>", methods=["GET", "POST"])
def step(name):
    page_info = {}
    header_style = "standard"  # Default to 'standard' font

    if request.method == "POST":
        persistence.save_settings(request.referrer, request.form)
        header_style = request.form.get("header_style", "standard")

    # Call `refresh_plex_libraries()` BEFORE retrieving Plex settings
    refresh_plex_libraries()

    # Retrieve available fonts (ensuring "none" and "single line" are always included)
    available_fonts = helpers.get_pyfiglet_fonts()

    page_info["available_fonts"] = available_fonts

    # Ensure session["config_name"] always exists
    if "config_name" not in session:
        session["config_name"] = namesgenerator.get_random_name()
        app.logger.info(f"Assigned new config_name: {session['config_name']}")

    # Retrieve stored settings from DB
    saved_settings = persistence.retrieve_settings(name)  # Retrieve from DB

    # Ensure we correctly access header_style from "final"
    if "final" in saved_settings and "header_style" in saved_settings["final"]:
        header_style = saved_settings["final"]["header_style"]

    if header_style is None:
        header_style = "none"

    # Ensure the selected font is valid
    if header_style not in available_fonts:
        header_style = "standard"

    page_info["header_style"] = header_style  # Now properly restored

    # Get selected config from form data (sent from the dropdown)
    selected_config = request.form.get("configSelector")  # Comes from the dropdown
    new_config_name = request.form.get("newConfigName")  # If "Add Config" is used

    # If "Add Config" is selected, use newConfigName instead
    if selected_config == "add_config" and new_config_name:
        selected_config = new_config_name.strip()

    # If no config is selected, fall back to the session or generate a new one
    if not selected_config:
        selected_config = session.get("config_name") or namesgenerator.get_random_name()

    # Update session with the chosen config
    session["config_name"] = selected_config
    page_info["config_name"] = selected_config
    page_info["header_style"] = header_style
    page_info["template_name"] = name

    # Generate a placeholder name for "Add Config"
    page_info["new_config_name"] = namesgenerator.get_random_name()

    # Fetch available configurations from the database
    available_configs = database.get_unique_config_names() or []

    # Ensure the selected config is either in the dropdown or newly created
    if selected_config not in available_configs:
        page_info["new_config_name"] = selected_config  # Use the new config name

    file_list = helpers.get_menu_list()
    template_list = helpers.get_template_list()
    total_steps = len(template_list)

    stem, num, b = helpers.get_bits(name)

    try:
        current_index = list(template_list).index(num)
        item = template_list[num]
    except (ValueError, IndexError, KeyError):
        return f"ERROR WITH NAME {name}; stem, num, b: {stem}, {num}, {b}"

    page_info["progress"] = round((current_index + 1) / total_steps * 100)
    page_info["title"] = item["name"]
    page_info["next_page"] = item["next"]
    page_info["prev_page"] = item["prev"]

    try:
        # Only split if the value is not None or empty
        if page_info["next_page"]:
            next_num = page_info["next_page"].split("-")[0]
            page_info["next_page_name"] = template_list.get(next_num, {}).get("name", "Next")
        else:
            page_info["next_page_name"] = "Next"

        if page_info["prev_page"]:
            prev_num = page_info["prev_page"].split("-")[0]
            page_info["prev_page_name"] = template_list.get(prev_num, {}).get("name", "Previous")
        else:
            page_info["prev_page_name"] = "Previous"

    except Exception as e:
        if app.config["QS_DEBUG"]:
            print(f"[ERROR] Failed to get page names: {e}")
        page_info["next_page_name"] = "Next"
        page_info["prev_page_name"] = "Previous"

    # Retrieve data from storage
    data = persistence.retrieve_settings(name)
    if app.config["QS_DEBUG"]:
        print(f"[DEBUG] Raw data retrieved for {name}: {data}")

    # Fetch Plex settings
    all_libraries = persistence.retrieve_settings("010-plex")

    # Debug: Print entire structure
    if app.config["QS_DEBUG"]:
        print("[DEBUG] all_libraries content:", all_libraries)

    # Ensure 'plex' key exists before accessing sub-keys
    plex_data = all_libraries.get("plex", {})

    # Extract the movie and show libraries
    movie_libraries_raw = plex_data.get("tmp_movie_libraries", "")
    show_libraries_raw = plex_data.get("tmp_show_libraries", "")

    # Debugging extracted values
    if app.config["QS_DEBUG"]:
        print("[DEBUG] Extracted movie libraries:", movie_libraries_raw)
        print("[DEBUG] Extracted show libraries:", show_libraries_raw)

    # Ensure it's a string before splitting
    if not isinstance(movie_libraries_raw, str):
        if app.config["QS_DEBUG"]:
            print("[ERROR] tmp_movie_libraries is not a string!")

        movie_libraries_raw = ""

    if not isinstance(show_libraries_raw, str):
        if app.config["QS_DEBUG"]:
            print("[ERROR] tmp_show_libraries is not a string!")

        show_libraries_raw = ""

    existing_ids = set()  # Track used IDs to prevent duplicates

    movie_libraries = [
        {
            "id": f"mov-library_{helpers.normalize_id(lib.strip(), existing_ids)}",
            "name": lib.strip(),
            "type": "movie",
        }
        for lib in movie_libraries_raw.split(",")
        if lib.strip()
    ]

    show_libraries = [
        {
            "id": f"sho-library_{helpers.normalize_id(lib.strip(), existing_ids)}",
            "name": lib.strip(),
            "type": "show",
        }
        for lib in show_libraries_raw.split(",")
        if lib.strip()
    ]

    # Ensure `libraries` dictionary exists
    if "libraries" not in data:
        data["libraries"] = {}

    # Ensure `mov-template_variables` and `sho-template_variables` exist inside `libraries`
    if "mov-template_variables" not in data["libraries"]:
        data["libraries"]["mov-template_variables"] = {}

    if "sho-template_variables" not in data["libraries"]:
        data["libraries"]["sho-template_variables"] = {}

    if app.config["QS_DEBUG"]:
        print(f"[DEBUG] ************************************************************************")
        print(f"[DEBUG] Data retrieved for {name}")

    (
        page_info["plex_valid"],
        page_info["tmdb_valid"],
        page_info["libs_valid"],
        page_info["sett_valid"],
    ) = persistence.check_minimum_settings()

    (
        page_info["notifiarr_available"],
        page_info["gotify_available"],
        page_info["ntfy_available"],
    ) = persistence.notification_systems_available()

    # Ensure template variables exist
    if "mov-template_variables" not in data:
        data["mov-template_variables"] = {}
    if "sho-template_variables" not in data:
        data["sho-template_variables"] = {}

    # Ensure these are lists
    plex_data["tmp_movie_libraries"] = plex_data.get("tmp_movie_libraries", "").split(",") if isinstance(plex_data.get("tmp_movie_libraries"), str) else []
    plex_data["tmp_show_libraries"] = plex_data.get("tmp_show_libraries", "").split(",") if isinstance(plex_data.get("tmp_show_libraries"), str) else []
    plex_data["tmp_music_libraries"] = plex_data.get("tmp_music_libraries", "").split(",") if isinstance(plex_data.get("tmp_music_libraries"), str) else []
    plex_data["tmp_user_list"] = plex_data.get("tmp_user_list", "").split(",") if isinstance(plex_data.get("tmp_user_list"), str) else []

    # Ensure correct rendering for the final validation page
    config_name = session.get("config_name") or page_info.get("config_name", "default")
    if name == "900-final":
        validated, validation_error, config_data, yaml_content = output.build_config(header_style, config_name=config_name)

        page_info["yaml_valid"] = validated
        session["yaml_content"] = yaml_content

        return render_template(
            "900-final.html",
            page_info=page_info,
            data=data,
            yaml_content=yaml_content,
            validation_error=validation_error,
            template_list=file_list,
            available_configs=available_configs,
        )

    else:
        section_config = helpers.load_quickstart_sections()
        return render_template(
            name + ".html",
            page_info=page_info,
            data=data,
            plex_data=plex_data,
            movie_libraries=movie_libraries,
            show_libraries=show_libraries,
            section_config=section_config,
            template_list=file_list,
            available_configs=available_configs,
        )


@app.route("/get_top_imdb_items/<library_name>")
def get_top_imdb_items_route(library_name):
    media_type = request.args.get("type", "movie")
    placeholder_id = request.args.get("placeholder_id")
    settings = persistence.retrieve_settings("010-plex")
    plex_settings = settings.get("plex", {})

    tmp_key = f"tmp_{media_type}_libraries"
    raw_libraries = plex_settings.get(tmp_key, "")
    library_names = [lib.strip() for lib in raw_libraries.split(",") if lib.strip()]

    print(f"[DEBUG] Searching for library name: {library_name}")
    print(f"[DEBUG] Available libraries of type '{media_type}': {library_names}")

    if library_name not in library_names:
        return jsonify(
            {
                "status": "error",
                "message": f"Library '{library_name}' not found in Plex settings.",
            }
        )

    # Call with placeholder_id
    items, saved_item = helpers.get_top_imdb_items(library_name, media_type, placeholder_id)

    return jsonify({"status": "success", "items": items, "saved_item": saved_item})


@app.route("/download")
def download():
    yaml_content = session.get("yaml_content", "")
    if yaml_content:
        return send_file(
            io.BytesIO(yaml_content.encode("utf-8")),
            mimetype="text/yaml",
            as_attachment=True,
            download_name="config.yml",
        )
    flash("No configuration to download", "danger")
    return redirect(request.referrer or url_for("step", page="900-final"))


@app.route("/download_redacted")
def download_redacted():
    yaml_content = session.get("yaml_content", "")
    if yaml_content:
        # Redact sensitive information
        redacted_content = helpers.redact_sensitive_data(yaml_content)

        # Serve the redacted YAML as a file download
        return send_file(
            io.BytesIO(redacted_content.encode("utf-8")),
            mimetype="text/yaml",
            as_attachment=True,
            download_name="config_redacted.yml",
        )
    flash("No configuration to download", "danger")
    return redirect(request.referrer or url_for("step", page="900-final"))


@app.route("/validate_gotify", methods=["POST"])
def validate_gotify():
    data = request.json
    return validations.validate_gotify_server(data)


@app.route("/validate_ntfy", methods=["POST"])
def validate_ntfy():
    data = request.json
    return validations.validate_ntfy_server(data)


@app.route("/validate_plex", methods=["POST"])
def validate_plex():
    data = request.json
    return validations.validate_plex_server(data)


@app.route("/refresh_plex_libraries", methods=["POST"])
def refresh_plex_libraries():
    try:
        # Get stored Plex credentials from DB
        config_name = session.get("config_name")  # Ensure the session has config_name
        if not config_name:
            return jsonify({"valid": False, "error": "Missing config_name"}), 400

        plex_url, plex_token = persistence.get_stored_plex_credentials("010-plex")  # Fetch from DB

        # Load default values from config.yml.template
        dummy_plex_config = persistence.get_dummy_data("plex")  # Retrieves {"url": "...", "token": "..."}
        default_plex_url = dummy_plex_config.get("url", "")
        default_plex_token = dummy_plex_config.get("token", "")

        # Exit early if the Plex credentials are still using default placeholder values
        if not plex_url or not plex_token or plex_url == default_plex_url or plex_token == default_plex_token:
            return (
                jsonify(
                    {
                        "valid": False,
                        "error": "Plex credentials are using default placeholder values",
                    }
                ),
                400,
            )

        # Fetch latest libraries from Plex
        plex_response = validations.validate_plex_server({"plex_url": plex_url, "plex_token": plex_token})

        # Fix: Convert Flask response object to JSON before accessing data.
        if isinstance(plex_response, Flask.response_class):
            plex_data = plex_response.get_json()  # Extract JSON data correctly
        else:
            plex_data = plex_response  # If already a dict, use as-is

        if not plex_data.get("validated"):
            return jsonify({"valid": False, "error": "Plex validation failed"}), 500

        # Extract new library data
        updated_movie_libraries = plex_data.get("movie_libraries", [])
        updated_show_libraries = plex_data.get("show_libraries", [])
        updated_music_libraries = plex_data.get("music_libraries", [])

        # Update the DB with the latest libraries
        persistence.update_stored_plex_libraries(
            "010-plex",
            updated_movie_libraries,
            updated_show_libraries,
            updated_music_libraries,
        )

        return jsonify(plex_data)  # Return refreshed data

    except Exception as e:
        return jsonify({"valid": False, "error": f"Server error: {str(e)}"}), 500


@app.route("/validate_tautulli", methods=["POST"])
def validate_tautulli():
    data = request.json
    return validations.validate_tautulli_server(data)


@app.route("/validate_trakt", methods=["POST"])
def validate_trakt():
    data = request.json
    return validations.validate_trakt_server(data)


@app.route("/validate_mal", methods=["POST"])
def validate_mal():
    data = request.json
    return validations.validate_mal_server(data)


@app.route("/validate_anidb", methods=["POST"])
def validate_anidb():
    data = request.json
    return validations.validate_anidb_server(data)


@app.route("/validate_webhook", methods=["POST"])
def validate_webhook():
    data = request.json
    return validations.validate_webhook_server(data)


@app.route("/validate_radarr", methods=["POST"])
def validate_radarr():
    data = request.json
    result = validations.validate_radarr_server(data)

    if result.get_json().get("valid"):
        return jsonify(result.get_json())
    else:
        return jsonify(result.get_json()), 400


@app.route("/validate_sonarr", methods=["POST"])
def validate_sonarr():
    data = request.json
    result = validations.validate_sonarr_server(data)

    if result.get_json().get("valid"):
        return jsonify(result.get_json())
    else:
        return jsonify(result.get_json()), 400


@app.route("/validate_omdb", methods=["POST"])
def validate_omdb():
    data = request.json
    result = validations.validate_omdb_server(data)

    if result.get_json().get("valid"):
        return jsonify(result.get_json())
    else:
        return jsonify(result.get_json()), 400


@app.route("/validate_github", methods=["POST"])
def validate_github():
    data = request.json
    result = validations.validate_github_server(data)

    if result.get_json().get("valid"):
        return jsonify(result.get_json())
    else:
        return jsonify(result.get_json()), 400


@app.route("/validate_tmdb", methods=["POST"])
def validate_tmdb():
    data = request.json
    result = validations.validate_tmdb_server(data)

    if result.get_json().get("valid"):
        return jsonify(result.get_json())
    else:
        return jsonify(result.get_json()), 400


@app.route("/validate_mdblist", methods=["POST"])
def validate_mdblist():
    data = request.json
    result = validations.validate_mdblist_server(data)

    if result.get_json().get("valid"):
        return jsonify(result.get_json())
    else:
        return jsonify(result.get_json()), 400


@app.route("/validate_notifiarr", methods=["POST"])
def validate_notifiarr():
    data = request.json
    result = validations.validate_notifiarr_server(data)

    if result.get_json().get("valid"):
        return jsonify(result.get_json())
    else:
        return jsonify(result.get_json()), 400


@app.route("/shutdown")
def shutdown():
    func = request.environ.get("werkzeug.server.shutdown")
    if func:
        func()
    return "Shutting down...", 200


server_thread = None
update_thread = None
if __name__ == "__main__":

    def start_flask_app():
        serve(app, host="0.0.0.0", port=port)

    def start_update_thread(app_in):
        with app_in.app_context():
            while True:
                app_in.config["VERSION_CHECK"] = helpers.check_for_update()
                print("[INFO] Checked for updates.")
                time.sleep(86400)

    update_thread = threading.Thread(target=start_update_thread, args=(app,), daemon=True)
    update_thread.start()

    def get_lan_ip():
        try:
            # Connect to a dummy address to get the local IP used
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "localhost"

    try:
        from PyQt5.QtGui import QIcon
        from PyQt5.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QAction, QInputDialog, QMessageBox, QWidget
        from PyQt5.QtCore import Qt, QTimer

        if app.config["QUICKSTART_DOCKER"]:
            has_tray = False
        elif sys.platform.startswith("linux"):
            has_tray = bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
        elif sys.platform == "darwin" or sys.platform.startswith("win"):
            has_tray = True
        else:
            has_tray = False
    except (ModuleNotFoundError, ImportError) as ie:
        has_tray = False

    if has_tray:
        # Headless mode: skip system tray
        print("[INFO] Running in headless mode — no system tray will be shown.")
        if app.config["QUICKSTART_DOCKER"]:
            print("Quickstart is Running inside Docker.")
            print(f"Access it at http://<your-server-ip>:{running_port}")
            print("Note: This IP is the HOST machine IP, not the container IP.")
        else:
            ip_address = get_lan_ip()
            print("Quickstart is Running")
            print(f"Access it at http://{ip_address}:{running_port}")

        print("Port and Debug Settings can be amended by editing your .env file")
        server_thread = Thread(target=start_flask_app)
        server_thread.daemon = True
        server_thread.start()

        try:
            while True:
                time.sleep(1)  # Keep main thread alive
        except KeyboardInterrupt:
            print("\n[INFO] Shutting down Quickstart...")
            sys.exit(0)

    else:
        # GUI mode: show tray

        server_thread = Thread(target=start_flask_app)
        server_thread.daemon = True
        server_thread.start()

        class QuickstartTrayApp:
            def __init__(self):
                self.app = QApplication(sys.argv)
                self.app.setQuitOnLastWindowClosed(False)
                self.app.setApplicationName("Quickstart")

                self.dialog_parent = QWidget()
                self.dialog_parent.setWindowTitle("Quickstart")
                self.dialog_parent.setAttribute(Qt.WA_DontShowOnScreen, True)

                self.tray = QSystemTrayIcon()
                self.icon_path = os.path.join(helpers.MEIPASS_DIR, "static", "favicon.png")

                self.tray.setIcon(QIcon(self.icon_path))
                self.tray.setToolTip(f"Quickstart (Port: {running_port})")

                self.menu = QMenu()

                self.open_action = QAction(f"Open Quickstart (Port: {running_port})")
                self.open_action.triggered.connect(self.open_quickstart)

                self.github_action = QAction("Quickstart GitHub")
                self.github_action.triggered.connect(lambda: webbrowser.open("https://github.com/Kometa-Team/Quickstart"))

                self.toggle_debug_action = QAction(f"{'Disable' if debug_mode else 'Enable'} Debug")
                self.toggle_debug_action.triggered.connect(self.toggle_debug)

                self.change_port_action = QAction("Change Port")
                self.change_port_action.triggered.connect(self.change_port)

                self.quit_action = QAction("Exit")
                self.quit_action.triggered.connect(self.quit_app)

                self.menu.addAction(self.open_action)
                self.menu.addAction(self.github_action)
                self.menu.addSeparator()
                self.menu.addAction(self.toggle_debug_action)
                self.menu.addAction(self.change_port_action)
                self.menu.addSeparator()
                self.menu.addAction(self.quit_action)

                self.tray.setContextMenu(self.menu)
                self.tray.show()

                ip_address = get_lan_ip()

                self.tray.showMessage(
                    "Quickstart is Running",
                    f"Local: http://localhost:{running_port}\nLAN: http://{ip_address}:{running_port}",
                    QSystemTrayIcon.NoIcon,
                    8000,
                )

                print("Quickstart is Running")
                print(f"Access it locally at: http://localhost:{running_port}")
                print(f"Access it from other devices at: http://{ip_address}:{running_port}")
                print("Port and Debug Settings can be amended by right-clicking the system tray icon or by editing your .env file")  # Open the browser automatically
                webbrowser.open(f"http://localhost:{running_port}")

                # Keep the invisible parent alive
                self.dialog_parent.showMinimized()
                self.dialog_parent.hide()

                # Ensure Qt stays alive (important in tray-only apps)
                QTimer.singleShot(0, lambda: None)  # No-op to lock event loop

            def exec(self):
                """Run the Qt app loop."""
                self.app.exec()

            def open_quickstart(self):
                webbrowser.open(f"http://localhost:{running_port}")

            def toggle_debug(self):
                global debug_mode
                debug_mode = not debug_mode
                helpers.update_env_variable("QS_DEBUG", "1" if debug_mode else "0")
                app.config["QS_DEBUG"] = debug_mode
                self.toggle_debug_action.setText(f"{'Disable' if debug_mode else 'Enable'} Debug")

            def show_messagebox(self, box_type, title, text):
                box = QMessageBox(self.dialog_parent)
                box.setWindowTitle(title)
                box.setText(text)
                box.setIcon(box_type)
                box.setStandardButtons(QMessageBox.Ok)
                box.setWindowFlags(box.windowFlags() & ~Qt.WindowContextHelpButtonHint)
                box.setWindowIcon(QIcon(self.icon_path))
                box.exec()

            def change_port(self):
                global port
                try:
                    print("[DEBUG] Launching custom port input dialog...")

                    dialog = QInputDialog(self.dialog_parent)
                    dialog.setWindowTitle("Change Port")
                    dialog.setLabelText("Enter a new port number:")
                    dialog.setInputMode(QInputDialog.IntInput)
                    dialog.setIntMinimum(1)
                    dialog.setIntMaximum(65535)
                    dialog.setIntValue(port)

                    # Remove help button and set custom icon
                    dialog.setWindowFlags(dialog.windowFlags() & ~Qt.WindowContextHelpButtonHint)
                    dialog.setWindowIcon(QIcon(self.icon_path))

                    # Execute dialog
                    if dialog.exec() != QInputDialog.Accepted:
                        print("[INFO] Port change canceled by user.")
                        return

                    new_port = dialog.intValue()
                    print(f"[INFO] User entered new port: {new_port}")

                    if new_port == port:
                        self.show_messagebox(
                            QMessageBox.Information,
                            "Port Already Selected",
                            f"Port {new_port} is already selected.",
                        )
                    else:
                        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                            if sock.connect_ex(("localhost", new_port)) == 0:
                                self.show_messagebox(
                                    QMessageBox.Warning,
                                    "Port Conflict",
                                    f"Port {new_port} is already in use.\nClose any conflicting applications or choose another port.",
                                )
                            else:
                                helpers.update_env_variable("QS_PORT", new_port)
                                self.show_messagebox(
                                    QMessageBox.Information,
                                    "Port Updated",
                                    f"Port number updated to {new_port}.\nQuickstart will now restart automatically.",
                                )
                                self.restart_quickstart()

                except Exception as e:
                    print(f"[ERROR] Port change error: {e}")

            def quit_app(self):
                global server_thread, update_thread

                print("[INFO] Shutting down Quickstart...")

                # Stop tray icon
                self.tray.hide()

                # Optionally stop Flask server (if you have added a stop hook)
                # For now, just wait for background threads to finish
                if server_thread and server_thread.is_alive():
                    print("[DEBUG] Waiting for server thread to exit...")
                    server_thread.join(timeout=2)

                if update_thread and update_thread.is_alive():
                    print("[DEBUG] Waiting for update thread to exit...")
                    update_thread.join(timeout=2)

                # Exit the Qt app loop
                self.app.quit()

            def restart_quickstart(self):
                """Cleanly restart the Quickstart application."""
                print("[INFO] Restarting Quickstart...")
                self.tray.hide()

                python = sys.executable
                os.execl(python, python, *sys.argv)

        QuickstartTrayApp().exec()
