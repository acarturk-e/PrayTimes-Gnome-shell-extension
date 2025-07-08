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
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Utils from './utils.js';

export default class PrayTimesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        // General Tab
        const generalPage = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(generalPage);

        this._addLocationSection(generalPage, window._settings);
        this._addTimezoneSection(generalPage, window._settings);

        // Display Tab
        const displayPage = new Adw.PreferencesPage({
            title: _('Display'),
            icon_name: 'preferences-desktop-display-symbolic',
        });
        window.add(displayPage);

        this._addShowTimesSection(displayPage, window._settings);
        this._addTimeFormatSection(displayPage, window._settings);

        // Calculation Tab
        const calcPage = new Adw.PreferencesPage({
            title: _('Calculation'),
            icon_name: 'accessories-calculator-symbolic',
        });
        window.add(calcPage);

        this._addCalculationMethodSection(calcPage, window._settings);
        this._addOtherSettingsSection(calcPage, window._settings);

        // Alerts Tab
        const alertsPage = new Adw.PreferencesPage({
            title: _('Alerts'),
            icon_name: 'preferences-system-notifications-symbolic',
        });
        window.add(alertsPage);

        this._addNotificationsSection(alertsPage, window._settings);
        this._addCountdownSection(alertsPage, window._settings);

        // Sound Tab
        const soundPage = new Adw.PreferencesPage({
            title: _('Sound'),
            icon_name: 'audio-volume-high-symbolic',
        });
        window.add(soundPage);

        this._addAdhanSection(soundPage, window._settings);
    }

    _addLocationSection(page, settings) {
        const locationGroup = new Adw.PreferencesGroup({
            title: _('Location'),
        });
        page.add(locationGroup);

        // Create location list container
        this._locationListBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            css_classes: ['boxed-list'],
        });
        
        const locationListFrame = new Gtk.Frame({
            child: this._locationListBox,
            margin_bottom: 12,
        });
        
        // Create a container for the location list
        const locationContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
        });
        locationContainer.append(locationListFrame);
        
        // Add location button and entry
        const addLocationBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_bottom: 6,
        });
        
        this._locationEntry = new Gtk.Entry({
            placeholder_text: _('Enter city name (e.g., "London" or "New York, NY")'),
            hexpand: true,
        });
        
        const addButton = new Gtk.Button({
            label: _('Add Location'),
            css_classes: ['suggested-action'],
        });
        
        this._addSpinner = new Gtk.Spinner({
            margin_start: 6,
        });
        
        addLocationBox.append(this._locationEntry);
        addLocationBox.append(addButton);
        addLocationBox.append(this._addSpinner);
        locationContainer.append(addLocationBox);
        
        // Custom coordinates section (initially hidden)
        this._customLocationGroup = new Adw.PreferencesGroup({
            title: _('Custom Coordinates'),
            visible: false,
        });
        
        // Latitude
        const latRow = new Adw.SpinRow({
            title: _('Latitude'),
            adjustment: new Gtk.Adjustment({
                lower: -90,
                upper: 90,
                step_increment: 0.0001,
                page_increment: 1,
                value: settings.get_double('location-latitude'),
            }),
            digits: 4,
        });
        
        // Longitude
        const lngRow = new Adw.SpinRow({
            title: _('Longitude'),
            adjustment: new Gtk.Adjustment({
                lower: -180,
                upper: 180,
                step_increment: 0.0001,
                page_increment: 1,
                value: settings.get_double('location-longitude'),
            }),
            digits: 4,
        });
        
        const addCustomButton = new Gtk.Button({
            label: _('Add Custom Location'),
            css_classes: ['suggested-action'],
            margin_top: 6,
        });
        
        this._customLocationGroup.add(latRow);
        this._customLocationGroup.add(lngRow);
        this._customLocationGroup.add(addCustomButton);
        
        // Custom coordinates toggle button
        const customToggleButton = new Gtk.Button({
            label: _('Custom Coordinates'),
            margin_top: 6,
        });
        locationContainer.append(customToggleButton);
        
        // Add everything to the main group
        const locationExpander = new Adw.ExpanderRow({
            title: _('Saved Locations'),
        });
        locationExpander.add_row(new Adw.ActionRow({
            child: locationContainer,
        }));
        locationGroup.add(locationExpander);
        
        page.add(this._customLocationGroup);
        
        // Initialize the location list
        this._updateLocationList(settings);
        
        // Connect signals
        addButton.connect('clicked', () => {
            this._addLocationByName(settings);
        });
        
        this._locationEntry.connect('activate', () => {
            this._addLocationByName(settings);
        });
        
        customToggleButton.connect('clicked', () => {
            this._customLocationGroup.visible = !this._customLocationGroup.visible;
            customToggleButton.label = this._customLocationGroup.visible ? 
                _('Hide Custom Coordinates') : _('Custom Coordinates');
        });
        
        addCustomButton.connect('clicked', () => {
            const address = `Custom (${latRow.value.toFixed(4)}, ${lngRow.value.toFixed(4)})`;
            const newLocation = {
                address: address,
                lat: latRow.value,
                lng: lngRow.value
            };
            
            const index = Utils.addLocation(settings, newLocation);
            Utils.setCurrentLocation(settings, index);
            this._updateLocationList(settings);
            this._customLocationGroup.visible = false;
            customToggleButton.label = _('Custom Coordinates');
        });
        
        // Update coordinate inputs when they change
        latRow.connect('notify::value', () => {
            settings.set_double('location-latitude', latRow.value);
        });
        
        lngRow.connect('notify::value', () => {
            settings.set_double('location-longitude', lngRow.value);
        });
        
        // Listen for settings changes to update the UI
        settings.connect('changed::saved-locations', () => {
            this._updateLocationList(settings);
        });
        
        settings.connect('changed::current-location-index', () => {
            this._updateLocationList(settings);
        });
    }
    
    _updateLocationList(settings) {
        // Clear existing rows
        let child = this._locationListBox.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            this._locationListBox.remove(child);
            child = next;
        }
        
        const locationsString = settings.get_string('saved-locations');
        const locations = Utils.parseSavedLocations(locationsString);
        const currentIndex = settings.get_int('current-location-index');
        
        locations.forEach((location, index) => {
            const row = new Gtk.ListBoxRow();
            
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 12,
                margin_end: 12,
            });
            
            // Radio button
            const radio = new Gtk.CheckButton({
                active: index === currentIndex,
            });
            
            // Location label
            const label = new Gtk.Label({
                label: location.address,
                hexpand: true,
                xalign: 0,
            });
            
            // Delete button (only show if more than one location)
            const deleteButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                css_classes: ['flat'],
                sensitive: locations.length > 1,
            });
            
            box.append(radio);
            box.append(label);
            box.append(deleteButton);
            row.set_child(box);
            
            this._locationListBox.append(row);
            
            // Connect signals
            radio.connect('toggled', () => {
                if (radio.active) {
                    Utils.setCurrentLocation(settings, index);
                }
            });
            
            deleteButton.connect('clicked', () => {
                Utils.removeLocation(settings, index);
            });
        });
    }
    
    async _addLocationByName(settings) {
        const address = this._locationEntry.text.trim();
        if (!address) return;
        
        this._addSpinner.start();
        this._locationEntry.sensitive = false;
        
        try {
            const locations = await Utils.geocodeAddress(address);
            
            if (locations.length === 1) {
                // Single result, add directly
                const index = Utils.addLocation(settings, locations[0]);
                Utils.setCurrentLocation(settings, index);
                this._locationEntry.text = '';
            } else if (locations.length > 1) {
                // Multiple results, show selection dialog
                this._showLocationSelectionDialog(settings, locations);
                this._locationEntry.text = '';
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            this._showErrorDialog(_('Location not found'), 
                _('Could not find the specified location. Please try a different search term.'));
        } finally {
            this._addSpinner.stop();
            this._locationEntry.sensitive = true;
        }
    }
    
    _showLocationSelectionDialog(settings, locations) {
        const dialog = new Adw.MessageDialog({
            heading: _('Multiple Locations Found'),
            body: _('Please select the correct location:'),
            modal: true,
            transient_for: this.get_root(),
        });
        
        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            css_classes: ['boxed-list'],
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });
        
        locations.forEach((location, index) => {
            const row = new Gtk.ListBoxRow();
            const label = new Gtk.Label({
                label: location.address,
                margin_top: 8,
                margin_bottom: 8,
                margin_start: 12,
                margin_end: 12,
                wrap: true,
                xalign: 0,
            });
            row.set_child(label);
            listBox.append(row);
        });
        
        dialog.set_extra_child(listBox);
        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('select', _('Select'));
        dialog.set_response_appearance('select', Adw.ResponseAppearance.SUGGESTED);
        dialog.set_default_response('select');
        
        dialog.connect('response', (dialog, response) => {
            if (response === 'select') {
                const selectedRow = listBox.get_selected_row();
                if (selectedRow) {
                    const selectedIndex = selectedRow.get_index();
                    const selectedLocation = locations[selectedIndex];
                    const index = Utils.addLocation(settings, selectedLocation);
                    Utils.setCurrentLocation(settings, index);
                }
            }
            dialog.close();
        });
        
        dialog.present();
    }
    
    _showErrorDialog(heading, body) {
        const dialog = new Adw.MessageDialog({
            heading: heading,
            body: body,
            modal: true,
            transient_for: this.get_root(),
        });
        dialog.add_response('ok', _('OK'));
        dialog.set_default_response('ok');
        dialog.present();
    }

    _addTimezoneSection(page, settings) {
        const timezoneGroup = new Adw.PreferencesGroup({
            title: _('Time Zone'),
            description: _('System default timezone will be used unless manual timezone is enabled'),
        });
        page.add(timezoneGroup);

        // Manual timezone toggle
        const manualTimezoneRow = new Adw.SwitchRow({
            title: _('Set time zone manually'),
            active: settings.get_boolean('timezone-manual'),
        });
        manualTimezoneRow.connect('notify::active', () => {
            settings.set_boolean('timezone-manual', manualTimezoneRow.active);
            timezoneRow.sensitive = manualTimezoneRow.active;
            daylightRow.sensitive = manualTimezoneRow.active;
        });
        timezoneGroup.add(manualTimezoneRow);

        // Timezone offset
        const timezoneRow = new Adw.SpinRow({
            title: _('Time Zone'),
            subtitle: _('UTC offset'),
            adjustment: new Gtk.Adjustment({
                lower: -12,
                upper: 14,
                step_increment: 0.5,
                page_increment: 1,
                value: settings.get_double('timezone-offset'),
            }),
            digits: 1,
            sensitive: settings.get_boolean('timezone-manual'),
        });
        timezoneRow.connect('notify::value', () => {
            settings.set_double('timezone-offset', timezoneRow.value);
        });
        timezoneGroup.add(timezoneRow);

        // Daylight saving
        const daylightRow = new Adw.SwitchRow({
            title: _('Add daylight saving'),
            active: settings.get_boolean('timezone-daylight'),
            sensitive: settings.get_boolean('timezone-manual'),
        });
        daylightRow.connect('notify::active', () => {
            settings.set_boolean('timezone-daylight', daylightRow.active);
        });
        timezoneGroup.add(daylightRow);
    }

    _addShowTimesSection(page, settings) {
        const showTimesGroup = new Adw.PreferencesGroup({
            title: _('Show Times'),
        });
        page.add(showTimesGroup);

        const times = [
            { key: 'show-fajr', title: _('Fajr') },
            { key: 'show-sunrise', title: _('Sunrise') },
            { key: 'show-dhuhr', title: _('Dhuhr') },
            { key: 'show-asr', title: _('Asr') },
            { key: 'show-sunset', title: _('Sunset') },
            { key: 'show-maghrib', title: _('Maghrib') },
            { key: 'show-isha', title: _('Isha') },
            { key: 'show-midnight', title: _('Midnight') },
        ];

        times.forEach(time => {
            const row = new Adw.SwitchRow({
                title: time.title,
                active: settings.get_boolean(time.key),
            });
            row.connect('notify::active', () => {
                settings.set_boolean(time.key, row.active);
            });
            showTimesGroup.add(row);
        });
    }

    _addTimeFormatSection(page, settings) {
        const formatGroup = new Adw.PreferencesGroup({
            title: _('Time Format'),
        });
        page.add(formatGroup);

        const formatRow = new Adw.ComboRow({
            title: _('Format'),
            model: new Gtk.StringList({
                strings: [_('12-hours'), _('24-hours')],
            }),
        });

        const currentFormat = settings.get_string('display-format');
        formatRow.selected = currentFormat === '24-hours' ? 1 : 0;

        formatRow.connect('notify::selected', () => {
            const format = formatRow.selected === 1 ? '24-hours' : '12-hours';
            settings.set_string('display-format', format);
        });
        formatGroup.add(formatRow);
    }

    _addCalculationMethodSection(page, settings) {
        const methodGroup = new Adw.PreferencesGroup({
            title: _('Calculation Method'),
        });
        page.add(methodGroup);

        const methodRow = new Adw.ComboRow({
            title: _('Method'),
            model: new Gtk.StringList({
                strings: [
                    _('Muslim World League'),
                    _('Islamic Society of North America (ISNA)'),
                    _('Egyptian General Authority of Survey'),
                    _('Umm Al-Qura University, Makkah'),
                    _('University of Islamic Sciences, Karachi'),
                    _('Institute of Geophysics, University of Tehran'),
                    _('Shia Ithna-Ashari, Leva Institute, Qum'),
                    _('Custom'),
                ],
            }),
        });

        const methods = ['MWL', 'ISNA', 'Egypt', 'Makkah', 'Karachi', 'Tehran', 'Jafari', 'Custom'];
        const currentMethod = settings.get_string('calculation-method');
        methodRow.selected = methods.indexOf(currentMethod);

        methodRow.connect('notify::selected', () => {
            settings.set_string('calculation-method', methods[methodRow.selected]);
            customGroup.visible = methods[methodRow.selected] === 'Custom';
        });
        methodGroup.add(methodRow);

        // Custom parameters (shown only when Custom is selected)
        const customGroup = new Adw.PreferencesGroup({
            title: _('Custom Parameters'),
            visible: currentMethod === 'Custom',
        });
        page.add(customGroup);

        // Fajr
        const fajrRow = new Adw.SpinRow({
            title: _('Fajr'),
            subtitle: _('Degrees'),
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 25,
                step_increment: 0.1,
                page_increment: 1,
                value: settings.get_double('custom-fajr'),
            }),
            digits: 1,
        });
        fajrRow.connect('notify::value', () => {
            settings.set_double('custom-fajr', fajrRow.value);
        });
        customGroup.add(fajrRow);

        // Maghrib
        const maghribRow = new Adw.SpinRow({
            title: _('Maghrib'),
            subtitle: _('Minutes after sunset'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 30,
                step_increment: 1,
                page_increment: 5,
                value: settings.get_double('custom-maghrib'),
            }),
            digits: 0,
        });
        maghribRow.connect('notify::value', () => {
            settings.set_double('custom-maghrib', maghribRow.value);
        });
        customGroup.add(maghribRow);

        // Isha
        const ishaRow = new Adw.SpinRow({
            title: _('Isha'),
            subtitle: _('Degrees or minutes after Maghrib'),
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 120,
                step_increment: 1,
                page_increment: 5,
                value: settings.get_double('custom-isha'),
            }),
            digits: 0,
        });
        ishaRow.connect('notify::value', () => {
            settings.set_double('custom-isha', ishaRow.value);
        });
        customGroup.add(ishaRow);
    }

    _addOtherSettingsSection(page, settings) {
        const otherGroup = new Adw.PreferencesGroup({
            title: _('Other Settings'),
        });
        page.add(otherGroup);

        // Dhuhr
        const dhuhrRow = new Adw.SpinRow({
            title: _('Dhuhr'),
            subtitle: _('Minutes after mid-day'),
            adjustment: new Gtk.Adjustment({
                lower: -5,
                upper: 5,
                step_increment: 1,
                page_increment: 1,
                value: settings.get_int('dhuhr-minutes'),
            }),
            digits: 0,
        });
        dhuhrRow.connect('notify::value', () => {
            settings.set_int('dhuhr-minutes', dhuhrRow.value);
        });
        otherGroup.add(dhuhrRow);

        // Asr
        const asrRow = new Adw.ComboRow({
            title: _('Asr'),
            model: new Gtk.StringList({
                strings: [_('Standard'), _('Hanafi')],
            }),
        });
        asrRow.selected = settings.get_string('asr-method') === 'Hanafi' ? 1 : 0;
        asrRow.connect('notify::selected', () => {
            settings.set_string('asr-method', asrRow.selected === 1 ? 'Hanafi' : 'Standard');
        });
        otherGroup.add(asrRow);

        // High latitude adjustment
        const highLatRow = new Adw.ComboRow({
            title: _('Adjustment'),
            subtitle: _('For locations with higher latitudes'),
            model: new Gtk.StringList({
                strings: [
                    _('Middle of Night'),
                    _('One-Seventh of Night'),
                    _('Angle-Based'),
                    _('None'),
                ],
            }),
        });
        const adjustments = ['NightMiddle', 'OneSeventh', 'AngleBased', 'None'];
        const currentAdj = settings.get_string('high-latitude-adjustment');
        highLatRow.selected = adjustments.indexOf(currentAdj);
        highLatRow.connect('notify::selected', () => {
            settings.set_string('high-latitude-adjustment', adjustments[highLatRow.selected]);
        });
        otherGroup.add(highLatRow);
    }

    _addNotificationsSection(page, settings) {
        const notifGroup = new Adw.PreferencesGroup({
            title: _('Notifications'),
        });
        page.add(notifGroup);

        // Pre-notification
        const preNotifRow = new Adw.SwitchRow({
            title: _('Display a notification before each prayer time'),
            active: settings.get_boolean('prenotification-enabled'),
        });
        preNotifRow.connect('notify::active', () => {
            settings.set_boolean('prenotification-enabled', preNotifRow.active);
            preNotifTimeRow.sensitive = preNotifRow.active;
        });
        notifGroup.add(preNotifRow);

        const preNotifTimeRow = new Adw.ComboRow({
            title: _('Pre-notification time'),
            model: new Gtk.StringList({
                strings: [
                    _('5 minutes'),
                    _('10 minutes'),
                    _('15 minutes'),
                    _('20 minutes'),
                    _('25 minutes'),
                    _('30 minutes'),
                ],
            }),
            sensitive: settings.get_boolean('prenotification-enabled'),
        });
        const prenotifValues = [5, 10, 15, 20, 25, 30];
        const currentPrenotif = settings.get_int('prenotification-minutes');
        preNotifTimeRow.selected = prenotifValues.indexOf(currentPrenotif);
        preNotifTimeRow.connect('notify::selected', () => {
            settings.set_int('prenotification-minutes', prenotifValues[preNotifTimeRow.selected]);
        });
        notifGroup.add(preNotifTimeRow);

        // Prayer time notification
        const prayerNotifRow = new Adw.SwitchRow({
            title: _('Display a notification at prayer times'),
            active: settings.get_boolean('notification-enabled'),
        });
        prayerNotifRow.connect('notify::active', () => {
            settings.set_boolean('notification-enabled', prayerNotifRow.active);
            notifTextRow.sensitive = prayerNotifRow.active;
        });
        notifGroup.add(prayerNotifRow);

        const notifTextRow = new Adw.EntryRow({
            title: _('Notification text'),
            text: settings.get_string('notification-text'),
            sensitive: settings.get_boolean('notification-enabled'),
        });
        notifTextRow.connect('notify::text', () => {
            settings.set_string('notification-text', notifTextRow.text);
        });
        notifGroup.add(notifTextRow);
    }

    _addCountdownSection(page, settings) {
        const countdownGroup = new Adw.PreferencesGroup({
            title: _('Countdown'),
        });
        page.add(countdownGroup);

        const countdownRow = new Adw.SwitchRow({
            title: _('Show countdown'),
            active: settings.get_boolean('countdown-enabled'),
        });
        countdownRow.connect('notify::active', () => {
            settings.set_boolean('countdown-enabled', countdownRow.active);
            countdownTimeRow.sensitive = countdownRow.active;
        });
        countdownGroup.add(countdownRow);

        const countdownTimeRow = new Adw.ComboRow({
            title: _('Alert time'),
            subtitle: _('Show countdown before each prayer time'),
            model: new Gtk.StringList({
                strings: [
                    _('5 minutes'),
                    _('10 minutes'),
                    _('15 minutes'),
                    _('30 minutes'),
                    _('60 minutes'),
                    _('Always'),
                ],
            }),
            sensitive: settings.get_boolean('countdown-enabled'),
        });
        const countdownValues = [5, 10, 15, 30, 60, 1000];
        const currentCountdown = settings.get_int('countdown-minutes');
        countdownTimeRow.selected = countdownValues.indexOf(currentCountdown);
        countdownTimeRow.connect('notify::selected', () => {
            settings.set_int('countdown-minutes', countdownValues[countdownTimeRow.selected]);
        });
        countdownGroup.add(countdownTimeRow);
    }

    _addAdhanSection(page, settings) {
        const adhanGroup = new Adw.PreferencesGroup({
            title: _('Adhan'),
        });
        page.add(adhanGroup);

        const adhanRow = new Adw.SwitchRow({
            title: _('Play adhan at prayer times'),
            active: settings.get_boolean('adhan-enabled'),
        });
        adhanRow.connect('notify::active', () => {
            settings.set_boolean('adhan-enabled', adhanRow.active);
            volumeRow.sensitive = adhanRow.active;
        });
        adhanGroup.add(adhanRow);

        const volumeRow = new Adw.SpinRow({
            title: _('Volume'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 10,
                page_increment: 10,
                value: settings.get_int('sound-volume'),
            }),
            digits: 0,
            sensitive: settings.get_boolean('adhan-enabled'),
        });
        volumeRow.connect('notify::value', () => {
            settings.set_int('sound-volume', volumeRow.value);
        });
        adhanGroup.add(volumeRow);
    }
}
