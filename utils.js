/*
GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2025 Prayer Times GNOME Extension Contributors
Original PrayTimes library Copyright (C) 2007-2025 PrayTimes.org

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

---

This GNOME Shell extension is based on the Prayer Times Firefox addon
by Hamid Zarrabi-Zadeh (http://praytimes.org), which was released under
similar and compatible open source terms (LGPL v3).

The PrayTimes calculation library is used under its original license
terms as published on http://praytimes.org.
*/
// Utility functions for the Prayer Times extension
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * Simple geocoding using Nominatim (OpenStreetMap)
 * This is free and doesn't require an API key
 */
export async function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=5&addressdetails=1`;
        
        // Use curl command synchronously for simplicity
        const curlCommand = `curl -s -A "PrayTimes-GNOME-Extension/1.0" "${url}"`;
        
        try {
            const [success, stdout] = GLib.spawn_command_line_sync(curlCommand);
            if (success) {
                const text = new TextDecoder().decode(stdout);
                const data = JSON.parse(text);
                
                if (data && data.length > 0) {
                    const locations = data.map(item => ({
                        address: _formatShortAddress(item),
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lon)
                    }));
                    resolve(locations);
                } else {
                    reject(new Error('No locations found'));
                }
            } else {
                reject(new Error('Network request failed'));
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Parse saved locations from settings string
 */
export function parseSavedLocations(locationsString) {
    try {
        return JSON.parse(locationsString);
    } catch (error) {
        console.error('Error parsing saved locations:', error);
        return [{ address: "Istanbul, Turkey", lat: 41.0082, lng: 28.9784 }];
    }
}

/**
 * Convert locations array to settings string
 */
export function stringifySavedLocations(locations) {
    return JSON.stringify(locations);
}

/**
 * Add a new location to the saved locations
 */
export function addLocation(settings, newLocation) {
    const locationsString = settings.get_string('saved-locations');
    const locations = parseSavedLocations(locationsString);
    
    // Check if location already exists
    const exists = locations.some(loc => 
        Math.abs(loc.lat - newLocation.lat) < 0.001 && 
        Math.abs(loc.lng - newLocation.lng) < 0.001
    );
    
    if (!exists) {
        locations.push(newLocation);
        settings.set_string('saved-locations', stringifySavedLocations(locations));
    }
    
    return locations.length - 1; // Return index of new location
}

/**
 * Remove a location from saved locations
 */
export function removeLocation(settings, index) {
    const locationsString = settings.get_string('saved-locations');
    const locations = parseSavedLocations(locationsString);
    
    if (index >= 0 && index < locations.length && locations.length > 1) {
        locations.splice(index, 1);
        settings.set_string('saved-locations', stringifySavedLocations(locations));
        
        // Adjust current location index if necessary
        const currentIndex = settings.get_int('current-location-index');
        if (currentIndex >= locations.length) {
            settings.set_int('current-location-index', locations.length - 1);
        } else if (currentIndex > index) {
            settings.set_int('current-location-index', currentIndex - 1);
        }
    }
}

/**
 * Get the currently selected location
 */
export function getCurrentLocation(settings) {
    const locationsString = settings.get_string('saved-locations');
    const locations = parseSavedLocations(locationsString);
    const currentIndex = settings.get_int('current-location-index');
    
    if (currentIndex >= 0 && currentIndex < locations.length) {
        return locations[currentIndex];
    }
    
    // Fallback to first location
    return locations[0] || { address: "Istanbul, Turkey", lat: 41.0082, lng: 28.9784 };
}

/**
 * Set the current location by index
 */
export function setCurrentLocation(settings, index) {
    const locationsString = settings.get_string('saved-locations');
    const locations = parseSavedLocations(locationsString);
    
    if (index >= 0 && index < locations.length) {
        settings.set_int('current-location-index', index);
        
        // Update the individual location settings for backward compatibility
        const location = locations[index];
        settings.set_string('location-address', location.address);
        settings.set_double('location-latitude', location.lat);
        settings.set_double('location-longitude', location.lng);
    }
}

/**
 * Format a short, user-friendly address from Nominatim result
 */
function _formatShortAddress(item) {
    const addr = item.address || {};
    const display = item.display_name || '';
    
    // Try to build a short address from components
    let parts = [];
    
    // Add city/town/village
    if (addr.city) {
        parts.push(addr.city);
    } else if (addr.town) {
        parts.push(addr.town);
    } else if (addr.village) {
        parts.push(addr.village);
    } else if (addr.municipality) {
        parts.push(addr.municipality);
    }
    
    // Add state/province if different from city
    if (addr.state && !parts.some(p => p === addr.state)) {
        parts.push(addr.state);
    } else if (addr.province && !parts.some(p => p === addr.province)) {
        parts.push(addr.province);
    }
    
    // Add country if not too long
    if (addr.country) {
        const country = addr.country;
        // Use short country names for common countries
        const shortCountries = {
            'United States': 'USA',
            'United Kingdom': 'UK',
            'Russian Federation': 'Russia',
            'United Arab Emirates': 'UAE'
        };
        parts.push(shortCountries[country] || country);
    }
    
    // If we have parts, join them
    if (parts.length > 0) {
        return parts.join(', ');
    }
    
    // Fallback: try to extract a shorter version from display_name
    const displayParts = display.split(', ');
    if (displayParts.length >= 3) {
        // Take first 2-3 parts for shorter display
        return displayParts.slice(0, 3).join(', ');
    }
    
    return display;
}
