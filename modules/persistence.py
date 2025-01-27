from flask import session
import os
import secrets
from ruamel.yaml import YAML
from flask import current_app as app

from .helpers import build_config_dict, get_template_list, get_bits, booler
from .iso_639_1 import iso_639_1_languages  # Importing the languages list
from .iso_639_2 import iso_639_2_languages  # Importing the languages list
from .iso_3166_1 import iso_3166_1_regions  # Importing the regions list

from .database import save_section_data, retrieve_section_data, reset_data


def extract_names(raw_source):
    source = raw_source

    # get source from referrer
    if raw_source.startswith("http"):
        source = raw_source.split("/")[-1]
        source = source.split("?")[0]

    source_name = source.split("-")[-1]
    # source will be `010-plex`
    # source_name will be `plex`

    return source, source_name


def clean_form_data(form_data):
    clean_data = {}
    for key, value in form_data.items():
        # Ensure asset_directory is processed as a list
        if key == "asset_directory":
            # Retrieve all values as a list
            value_list = form_data.getlist(key)
            # Clean each value in the list
            clean_data[key] = [v.strip() for v in value_list if v.strip()]
        elif isinstance(value, str):
            lc_value = value.lower()
            if len(value) == 0 or lc_value == "none":
                clean_data[key] = None
            elif lc_value in ["true", "on"]:
                clean_data[key] = True
            elif lc_value == "false":
                clean_data[key] = False
            else:
                clean_data[key] = value.strip()
        else:
            clean_data[key] = value
    return clean_data


def save_settings(raw_source, form_data):
    # Extract the source and source_name
    source, source_name = extract_names(raw_source)
    # Log raw form data
    print(f"[DEBUG] Raw form data received: {form_data}")

    # Handle asset_directory specifically
    if "asset_directory" in form_data:
        # Use getlist to retrieve all values for asset_directory
        asset_directories = form_data.getlist("asset_directory")
        print(f"[DEBUG] All asset_directory values from form: {asset_directories}")

    # Clean the data
    clean_data = clean_form_data(form_data)

    # Debug specific fields for Plex
    for field in ["plex_url", "plex_token"]:
        print(f"[DEBUG] Cleaned value for {field}: {clean_data.get(field)}")

    # Log the cleaned asset_directory
    if "asset_directory" in clean_data:
        print(f"[DEBUG] Cleaned asset_directory: {clean_data['asset_directory']}")

    # Build the dictionary to save
    data = build_config_dict(source_name, clean_data)

    # Debug final data to be saved
    print(f"[DEBUG] Final data structure to save: {data}")

    # Log the final data structure for asset_directory
    if source_name == "settings" and "asset_directory" in data.get("settings", {}):
        print(
            f"[DEBUG] Final asset_directory structure to save: {data['settings']['asset_directory']}"
        )

    # Proceed with saving
    base_data = get_dummy_data(source_name)
    user_entered = data != base_data
    validated = data.get("validated", False)

    save_section_data(
        name=session["config_name"],
        section=source_name,
        validated=validated,
        user_entered=user_entered,
        data=data,
    )

    # Confirm successful save
    print(f"[DEBUG] Data saved successfully.")


def retrieve_settings(target):
    # target will be `010-plex`
    data = {}

    # get source from referrer
    source, source_name = extract_names(target)
    # source will be `010-plex`
    # source_name will be `plex`

    db_data = retrieve_section_data(name=session["config_name"], section=source_name)
    # db_data is a tuple of validated, user_entered, data

    data["validated"] = booler(db_data[0])
    data["user_entered"] = booler(db_data[1])
    data[source_name] = db_data[2][source_name] if db_data[2] else None

    if not data[source_name]:
        data[source_name] = get_dummy_data(source_name)

    data["code_verifier"] = secrets.token_urlsafe(100)[:128]
    data["iso_639_1_languages"] = iso_639_1_languages
    data["iso_3166_1_regions"] = iso_3166_1_regions
    data["iso_639_1_languages"] = iso_639_1_languages
    data["iso_639_2_languages"] = iso_639_2_languages

    # if source_name == 'mal':
    #     data['code_verifier'] = secrets.token_urlsafe(100)[:128]

    # if source_name == 'tmdb':
    #     data['iso_639_1_languages'] = iso_639_1_languages
    #     data['iso_3166_1_regions'] = iso_3166_1_regions

    # if source_name == 'anidb':
    #     data['iso_639_1_languages'] = iso_639_1_languages

    # if target == '150-settings':
    #     data['iso_639_2_languages'] = iso_639_2_languages

    return data


def retrieve_status(target):
    # target will be `010-plex`
    # get source from referrer
    source, source_name = extract_names(target)
    # source will be `010-plex`
    # source_name will be `plex`

    db_data = retrieve_section_data(name=session["config_name"], section=source_name)
    # db_data is a tuple of validated, user_entered, data

    validated = booler(db_data[0])
    user_entered = booler(db_data[1])

    return validated, user_entered


def get_dummy_data(target):

    yaml = YAML(typ="safe", pure=True)
    with open("json-schema/prototype_config.yml", "r") as file:
        base_config = yaml.load(file)

    data = {}
    try:
        data = base_config[target]
    except:
        data = {}

    return data


def check_minimum_settings():
    plex_valid, plex_user_entered = retrieve_status("plex")
    tmdb_valid, tmdb_user_entered = retrieve_status("tmdb")
    libs_valid, libs_user_entered = retrieve_status("libraries")
    sett_valid, sett_user_entered = retrieve_status("settings")

    return plex_valid, tmdb_valid, libs_valid, sett_valid


def flush_session_storage(name):
    if not name:
        name = session["config_name"]
    [
        session.pop(key)
        for key in list(session.keys())
        if not key.startswith("config_name")
    ]
    reset_data(name)


def notification_systems_available():
    notifiarr_available, notifiarr_user_entered = retrieve_status("notifiarr")
    gotify_available, gotify_user_entered = retrieve_status("gotify")
    ntfy_available, ntfy_user_entered = retrieve_status("ntfy")

    return notifiarr_available, gotify_available, ntfy_available
