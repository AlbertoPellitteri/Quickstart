import io
import jsonschema
import pyfiglet
from ruamel.yaml import YAML

from .persistence import (
    save_settings,
    retrieve_settings,
    check_minimum_settings,
    flush_session_storage,
    notification_systems_available,
)
from .helpers import (
    build_config_dict,
    get_template_list,
    get_bits,
    enforce_string_fields,
    STRING_FIELDS,
)


def add_border_to_ascii_art(art):
    lines = art.split("\n")
    lines = lines[:-1]
    width = max(len(line) for line in lines)
    border_line = "#" * (width + 4)
    bordered_art = (
        [border_line] + [f"# {line.ljust(width)} #" for line in lines] + [border_line]
    )
    return "\n".join(bordered_art)


def section_heading(title):
    return add_border_to_ascii_art(pyfiglet.figlet_format(title))


def clean_section_data(section_data, config_attribute):
    """
    Cleans out temporary or irrelevant data before integrating it into the final config.
    """
    clean_data = {}

    for key, value in section_data.items():
        if key == config_attribute:
            if isinstance(value, dict):
                clean_sub_data = {}
                for sub_key, sub_value in value.items():
                    if not sub_key.startswith("tmp_"):
                        clean_sub_data[sub_key] = sub_value
                clean_data[key] = clean_sub_data
            else:
                clean_data[key] = value

    return clean_data


def build_libraries_section(
    movie_libraries,
    show_libraries,
    movie_collections,
    show_collections,
    movie_overlays,
    show_overlays,
    movie_attributes,
    show_attributes,
):
    """
    Build the libraries section for the YAML config, ensuring that settings are
    correctly applied to movies and shows. Exclude empty fields from the final output.
    """
    libraries_section = {}

    # Helper function to clean and add entries
    def add_entry(library_name, library_type, collections, overlays, attributes):
        entry = {}

        # Process collections
        collection_files = [
            {"default": collection.replace(f"{library_type}-collection_", "")}
            for collection, selected in collections.items()
            if selected
        ]
        if collection_files:
            entry["collection_files"] = collection_files

        # Process attributes
        for attr_key, attr_value in attributes.items():
            clean_key = attr_key.replace(f"{library_type}-attribute_", "")
            if attr_value not in [None, False, [], {}, ""]:
                entry[clean_key] = attr_value

        # Process overlays
        overlay_files = [
            {"default": overlay.replace(f"{library_type}-overlay_", "")}
            for overlay, selected in overlays.items()
            if selected
        ]
        if overlay_files:
            entry["overlay_files"] = overlay_files

        # Add only non-empty entries
        if entry:
            libraries_section[library_name] = entry

    # Process movie libraries
    for library_key, library_name in movie_libraries.items():
        add_entry(
            library_name, "mov", movie_collections, movie_overlays, movie_attributes
        )

    # Process show libraries
    for library_key, library_name in show_libraries.items():
        add_entry(library_name, "sho", show_collections, show_overlays, show_attributes)

    return {"libraries": libraries_section}


def build_config(header_style="ascii"):
    """
    Build the final configuration, including all sections and headers,
    ensuring the libraries section is properly processed.
    """
    sections = get_template_list()
    config_data = {}
    header_art = {}

    # Process sections and generate header art
    for name in sections:
        item = sections[name]
        persistence_key = item["stem"]
        config_attribute = item["raw_name"]

        # Generate ASCII art or divider headers
        if header_style == "ascii":
            header_art[config_attribute] = section_heading(item["name"])
        elif header_style == "divider":
            header_art[config_attribute] = (
                "#==================== " + item["name"] + " ====================#"
            )
        else:
            header_art[config_attribute] = ""

        # Retrieve settings for each section
        section_data = retrieve_settings(persistence_key)

        if "validated" in section_data and section_data["validated"]:
            # Clean and store data
            clean_data = clean_section_data(section_data, config_attribute)
            config_data[config_attribute] = clean_data

    # Process playlist_files section
    if "playlist_files" in config_data:
        playlist_data = config_data["playlist_files"]

        # Debug raw data
        print("Raw config_data['playlist_files'] content (Level 1):", playlist_data)

        # Adjust for possible extra nesting
        if "playlist_files" in playlist_data and isinstance(
            playlist_data["playlist_files"], dict
        ):
            playlist_data = playlist_data["playlist_files"]
            print("Adjusted playlist_data after extra nesting:", playlist_data)

        # Extract and process libraries
        libraries_value = playlist_data.get("libraries", "")
        print("Extracted libraries value:", libraries_value)

        libraries_list = [
            lib.strip() for lib in libraries_value.split(",") if lib.strip()
        ]
        print("Processed libraries list:", libraries_list)

        # Format playlist_files data
        formatted_playlist_files = {
            "playlist_files": [
                {
                    "default": "playlist",
                    "template_variables": {"libraries": libraries_list},
                }
            ]
        }
        print("Formatted playlist_files data:", formatted_playlist_files)

        # Replace in config_data
        config_data["playlist_files"] = formatted_playlist_files

    # Process the libraries section
    if "libraries" in config_data and "libraries" in config_data["libraries"]:
        nested_libraries_data = config_data["libraries"]["libraries"]

        # Debugging
        print("Raw nested libraries data:", nested_libraries_data)

        # Separate data by prefix
        movie_libraries = {
            key: value
            for key, value in nested_libraries_data.items()
            if key.startswith("mov-library_")
        }
        show_libraries = {
            key: value
            for key, value in nested_libraries_data.items()
            if key.startswith("sho-library_")
        }
        movie_collections = {
            key: value
            for key, value in nested_libraries_data.items()
            if key.startswith("mov-collection_")
        }
        show_collections = {
            key: value
            for key, value in nested_libraries_data.items()
            if key.startswith("sho-collection_")
        }
        movie_overlays = {
            key: value
            for key, value in nested_libraries_data.items()
            if key.startswith("mov-overlay_")
        }
        show_overlays = {
            key: value
            for key, value in nested_libraries_data.items()
            if key.startswith("sho-overlay_")
        }
        movie_attributes = {
            key: value
            for key, value in nested_libraries_data.items()
            if key.startswith("mov-attribute_")
        }
        show_attributes = {
            key: value
            for key, value in nested_libraries_data.items()
            if key.startswith("sho-attribute_")
        }

        # Debugging
        print("Extracted Movie Libraries:", movie_libraries)
        print("Extracted Show Libraries:", show_libraries)
        print("Extracted Movie Collections:", movie_collections)
        print("Extracted Show Collections:", show_collections)
        print("Extracted Movie Overlays:", movie_overlays)
        print("Extracted Show Overlays:", show_overlays)
        print("Extracted Movie Attributes:", movie_attributes)
        print("Extracted Show Attributes:", show_attributes)

        # Build nested libraries structure
        libraries_section = build_libraries_section(
            movie_libraries,
            show_libraries,
            movie_collections,
            show_collections,
            movie_overlays,
            show_overlays,
            movie_attributes,
            show_attributes,
        )
        config_data["libraries"] = libraries_section
        print("Final Libraries Section:", libraries_section)

    # Header comment for YAML file
    header_comment = (
        "### We highly recommend using Visual Studio Code with indent-rainbow by oderwat extension "
        "and YAML by Red Hat extension. VSC will also leverage the above link to enhance Kometa yml edits."
    )

    # Build YAML content
    yaml = YAML(typ="safe", pure=True)
    yaml.default_flow_style = False
    yaml.sort_keys = False

    with open("json-schema/config-schema.json", "r") as file:
        schema = yaml.load(file)

    # Prepare the final YAML content
    yaml_content = (
        "# yaml-language-server: $schema=https://raw.githubusercontent.com/Kometa-Team/Kometa/nightly/json-schema/config-schema.json\n\n"
        f"{section_heading('KOMETA') if header_style == 'ascii' else ('#==================== KOMETA ====================#' if header_style == 'divider' else '')}\n\n"
        f"{header_comment}\n\n"
    )

    # Function to dump YAML sections
    def dump_section(title, name, data):
        import ruamel.yaml

        yaml = ruamel.yaml.YAML()
        yaml.default_flow_style = False
        yaml.sort_keys = False

        # Custom representation for `None` values
        yaml.representer.add_representer(
            type(None),
            lambda self, _: self.represent_scalar("tag:yaml.org,2002:null", ""),
        )

        def clean_data(obj):
            if isinstance(obj, dict):
                # Sort specific sections alphabetically
                if name in [
                    "settings",
                    "webhooks",
                    "plex",
                    "tmdb",
                    "tautulli",
                    "github",
                    "omdb",
                    "mdblist",
                    "notifiarr",
                    "anidb",
                    "radarr",
                    "sonarr",
                    "trakt",
                    "mal",
                ]:
                    obj = dict(sorted(obj.items()))  # Alphabetically sort `settings`
                return {k: clean_data(v) for k, v in obj.items() if k != "valid"}
            elif isinstance(obj, list):
                return [clean_data(v) for v in obj]
            else:
                return obj

        # Clean the data
        cleaned_data = clean_data(data)

        # Dump the cleaned data to YAML
        with io.StringIO() as stream:
            yaml.dump(cleaned_data, stream)
            return f"{title}\n{stream.getvalue().strip()}\n\n"

    ordered_sections = [
        ("libraries", "025-libraries"),
        ("playlist_files", "027-playlist_files"),
        ("settings", "150-settings"),
        ("webhooks", "140-webhooks"),
        ("plex", "010-plex"),
        ("tmdb", "020-tmdb"),
        ("tautulli", "030-tautulli"),
        ("github", "040-github"),
        ("omdb", "050-omdb"),
        ("mdblist", "060-mdblist"),
        ("notifiarr", "070-notifiarr"),
        ("gotify", "080-gotify"),
        ("anidb", "090-anidb"),
        ("radarr", "100-radarr"),
        ("sonarr", "110-sonarr"),
        ("trakt", "120-trakt"),
        ("mal", "130-mal"),
    ]

    # Apply enforce_string_fields to ensure proper formatting
    config_data = enforce_string_fields(config_data, STRING_FIELDS)

    for section_key, section_stem in ordered_sections:
        if section_key in config_data:
            section_data = config_data[section_key]
            section_art = header_art[section_key]
            yaml_content += dump_section(section_art, section_key, section_data)

    validated = False
    validation_error = None

    try:
        jsonschema.validate(yaml.load(yaml_content), schema)
        validated = True
    except jsonschema.exceptions.ValidationError as e:
        validation_error = e

    return validated, validation_error, config_data, yaml_content
