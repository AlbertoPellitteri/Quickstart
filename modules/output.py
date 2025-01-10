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
from .helpers import build_config_dict, get_template_list, get_bits


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


def load_yaml_template(template_path="library_template.yml"):
    """
    Load the YAML template for a library section.
    """
    yaml = YAML()
    with open(template_path, "r") as file:
        return yaml.load(file)


def generate_library_sections_simple(
    selected_libraries, template_path="templates/library_template.yml"
):
    """
    Generate YAML entries for selected libraries by reading the template as plain text
    and replacing LIBRARYNAME with each selected library.
    """
    library_sections = []
    with open(template_path, "r") as template_file:
        template_content = template_file.read()

    for library in selected_libraries:
        # Replace LIBRARYNAME with the actual library name
        library_section = template_content.replace("LIBRARYNAME", library)
        # Add indentation to ensure proper nesting under "libraries:"
        indented_section = "  " + library_section.strip().replace("\n", "\n  ")
        library_sections.append(indented_section)

    # Construct the final output as a string
    result = "libraries:\n" + "\n".join(library_sections)
    return result


def clean_section_data(section_data, config_attribute):
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


def build_config(header_style="ascii"):
    sections = get_template_list()

    config_data = {}
    header_art = {}

    # Process sections and generate header art
    for name in sections:
        item = sections[name]
        # {'num': '001', 'file': '001-start.html', 'stem': '001-start', 'name': 'Start', 'raw_name': 'start', 'next': '010-plex', 'prev': '001-start'}
        persistence_key = item["stem"]
        config_attribute = item["raw_name"]

        if header_style == "ascii":
            header_art[config_attribute] = section_heading(item["name"])
        elif header_style == "divider":
            header_art[config_attribute] = (
                "#==================== " + item["name"] + " ====================#"
            )
        else:
            header_art[config_attribute] = ""

        section_data = retrieve_settings(persistence_key)

        # {'mal': {'authorization': {'code_verifier': 'OEOOZwnH8RWLczgahkUbo__vabgHl7XyvWkDx0twLB4FCaxPY88C9tNXnmxzBq946vSekKbPc3WhW4SwWrq0ld5xKpm27foQx4RXfnXY25iL7Pm0WCCuYkO-iQga69jv', 'localhost_url': '', 'access_token': 'None', 'token_type': 'None', 'expires_in': 'None', 'refresh_token': 'None'}, 'client_id': 'Enter MyAnimeList Client ID', 'client_secret': 'Enter MyAnimeList Client Secret'}, 'valid': True}

        if "validated" in section_data and section_data["validated"]:
            # it's valid data and needs to end up in the config
            # but first clear some chaff
            clean_data = clean_section_data(section_data, config_attribute)
            config_data[config_attribute] = clean_data

    # Process libraries specifically
    if "libraries" in config_data:
        libraries_data = config_data["libraries"].get("libraries", "")

        # If libraries_data is a dictionary, extract its values
        if isinstance(libraries_data, dict):
            libraries_data = libraries_data.get("libraries", "")

        # Ensure libraries_data is a string before splitting
        if isinstance(libraries_data, str):
            selected_libraries = libraries_data.split(",")
        else:
            selected_libraries = []

        selected_libraries = [lib.strip() for lib in selected_libraries if lib.strip()]

        # Generate the YAML entries as a dictionary
        library_sections = generate_library_sections_simple(selected_libraries)

        # Directly replace config_data["libraries"] with the generated structure
        yaml_loader = YAML(typ="safe", pure=True)  # Initialize a YAML instance
        config_data["libraries"] = yaml_loader.load(library_sections)

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
        # Convert 'true' and 'false' strings to boolean values
        #  this should be handled in the persistence
        for key, value in data.items():
            if value == "true":
                data[key] = True
            elif value == "false":
                data[key] = False

        # Remove 'valid' key if present
        data = {k: v for k, v in data.items() if k != "valid"}

        yaml = YAML()

        with io.StringIO() as stream:
            yaml.dump(data, stream)
            return f"{title}\n{stream.getvalue().strip()}\n\n"

    ordered_sections = [
        ("libraries", "015-libraries"),
        ("playlist_files", "160-playlist_files"),
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

    for section_key, section_stem in ordered_sections:
        if section_key in config_data:
            section_data = config_data[section_key]
            section_art = header_art[section_key]

            yaml_content += dump_section(section_art, section_key, section_data)

    print("\n==================================================\n")
    print(f"config_data:\n{config_data}")
    print("\n==================================================\n")
    print(f"yaml_content:\n{yaml_content}")
    print("\n==================================================\n")

    validated = False
    validation_error = None

    try:
        jsonschema.validate(yaml.load(yaml_content), schema)
        validated = True
    except jsonschema.exceptions.ValidationError as e:
        validation_error = e

    return validated, validation_error, config_data, yaml_content
