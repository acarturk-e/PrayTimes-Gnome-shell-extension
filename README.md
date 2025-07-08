# Prayer Times - GNOME Shell Extension

A GNOME Shell extension that displays daily Muslim prayer times. Ported from the original PrayTimes.org Firefox addon by Hamid Zarrabi-Zadeh.

Note: Port was mainly done via GitHub Copilot with minor manual vetting -- so the author *cannot* provide any guarantee or warranty for the quality of the extension right now, however, the code base will be solidified before v1.0 launch. Suggestions and contributions are welcome.

## Features

- **Accurate Prayer Time Calculations**: Uses the PrayTimes.org calculation engine with support for multiple calculation methods
- **Multiple Locations**: Add and switch between multiple saved locations easily
- **Smart Location Search**: Add locations by name with automatic coordinate fetching
- **Flexible Time Display**: 12-hour or 24-hour format options
- **Customizable Prayer Selection**: Show/hide individual prayer times as needed
- **Real-time Updates**: Live countdown to next prayer with minute-aligned updates
- **Notifications**: Optional notifications for prayer times and pre-notifications
- **GNOME Integration**: Native GNOME settings UI with proper Adwaita styling

## Installation

1. Download or clone this repository
2. Copy the extension folder to your GNOME extensions directory:
   ```bash
   cp -r praytimes-gnome-desktop@praytimes ~/.local/share/gnome-shell/extensions/
   ```
3. Compile the GSettings schema:
   ```bash
   cd ~/.local/share/gnome-shell/extensions/praytimes-gnome-desktop@praytimes/schemas
   glib-compile-schemas .
   ```
4. Restart GNOME Shell (Alt+F2, type 'r', press Enter) or log out and back in
5. Enable the extension:
   ```bash
   gnome-extensions enable praytimes-gnome-desktop@praytimes
   ```

## Usage

### Adding Locations
1. Open the extension preferences
2. In the Location section, type a city name (e.g., "London", "New York, NY")
3. Click "Add Location" to search and add the location
4. Switch between saved locations using the radio buttons
5. Use "Custom Coordinates" for manual coordinate entry if needed

### Configuring Prayer Times
- **Display Tab**: Choose time format and select which prayers to show
- **Calculation Tab**: Select calculation method and adjust parameters
- **Alerts Tab**: Configure notifications and countdown settings
- **Sound Tab**: Enable adhan playback (future feature)

### Panel Display
The extension shows in the top panel with:
- Next prayer name and time remaining
- Click to open detailed prayer times popup
- Clean table layout with highlighted next prayer

## Calculation Methods

Supports all major calculation methods:
- Muslim World League (MWL) - Default
- Islamic Society of North America (ISNA)
- Egyptian General Authority of Survey
- Umm Al-Qura University, Makkah
- University of Islamic Sciences, Karachi
- Institute of Geophysics, University of Tehran
- Shia Ithna-Ashari, Leva Institute, Qum
- Custom parameters

## Requirements

- GNOME Shell 45+ (tested on GNOME 48)
- `curl` for location geocoding
- Internet connection for adding new locations (manual coordinate option available as fallback)

## Development

### File Structure
```
praytimes-gnome-desktop@praytimes/
├── extension.js          # Main extension logic
├── prefs.js             # Preferences UI
├── utils.js             # Utility functions (geocoding, location management)
├── praytimes.js         # Prayer times calculation engine
├── metadata.json        # Extension metadata
├── stylesheet.css       # UI styling
├── schemas/             # GSettings schema
│   └── org.gnome.shell.extensions.praytimes.gschema.xml
├── icons/              # Extension icons
│   ├── icon.svg
│   ├── icon.png
│   └── icon768.png
```

## Credits

- **Original Firefox Addon**: Hamid Zarrabi-Zadeh (http://praytimes.org)
- **GNOME Shell Port**: Adapted for GNOME Shell with enhanced location management
- **Calculation Engine**: PrayTimes.org calculation library
- **Geocoding**: OpenStreetMap Nominatim service

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

## Changelog

### Version 0.1.0
- Initial GNOME Shell port from Firefox addon
- Streamlined location selection with online geocoding
- Native GNOME preferences UI with Adwaita styling
- Proper table layout for prayer times
- Live updates and notifications
- Multiple saved locations support
