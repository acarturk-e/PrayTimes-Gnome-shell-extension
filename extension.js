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
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import {Extension, gettext as _, ngettext, pgettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import PrayTimes from './praytimes.js';
import * as Utils from './utils.js';

function formatTime(timestamp, format = '24h') {
    let date = new Date(timestamp);
    let hours = date.getHours();
    let minutes = date.getMinutes();

    if (format === '12h') {
        let suffix = hours < 12 ? 'AM' : 'PM';
        hours = ((hours + 12 - 1) % 12 + 1);
        return `${hours}:${minutes.toString().padStart(2, '0')} ${suffix}`;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatDate(timestamp) {
    return new Date(timestamp).toDateString();
}

function getTimeLeftString(minsLeft) {
    let mins = minsLeft % 60;
    let hours = Math.floor(minsLeft / 60);
    let minsTag = (mins === 1) ? 'minute' : 'minutes';
    let hoursTag = (hours === 1) ? 'hour' : 'hours';
    let str = '';
    if (hours > 0)
        str = `${hours} ${hoursTag}` + (mins > 0 ? ' and ' : '');
    if (mins > 0)
        str += `${mins} ${minsTag}`;
    return str;
}

// Real prayer times calculation using imported PrayTimes library
function getPrayerTimes(date, coords, timezone, method = 'ISNA') {
    // Create PrayTimes instance with specified method
    let prayTimes = new PrayTimes(method);
    
    // Calculate times for the given date and coordinates
    // coords: [latitude, longitude]
    // timezone: offset in hours from UTC
    let times = prayTimes.getTimes(date, coords, timezone, 0, '24h');
    
    // Convert string times to Date objects
    let result = {};
    for (let prayer of ['fajr', 'sunrise', 'dhuhr', 'asr', 'sunset', 'maghrib', 'isha', 'midnight']) {
        if (times[prayer] && times[prayer] !== '-----') {
            // Parse time string (HH:MM format) and create Date object
            let [hours, minutes] = times[prayer].split(':').map(Number);
            let prayerDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
            result[prayer] = prayerDate;
        }
    }
    
    return result;
}

function getNextPrayer(times) {
    let now = new Date();
    for (let key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        if (now < times[key]) {
            return {name: key, time: times[key]};
        }
    }
    // If all passed, return tomorrow's Fajr
    let tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    let t = getPrayerTimes(tomorrow, [0,0], 0);
    return {name: 'fajr', time: t.fajr};
}

export default class PrayTimesGnomeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        const icon = new St.Icon({
            gicon: Gio.icon_new_for_string(`${this.path}/icons/icon.svg`),
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(icon);
        this._label = new St.Label({
            text: 'PrayTimes',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'praytimes-panel-label'
        });
        this._indicator.add_child(this._label);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Add popup menu items
        this._buildPopupMenu();

        // Listen for settings changes
        this._settingsChangedId = this._settings.connect('changed', () => {
            this._update();
        });

        this._update();
        this._scheduleNextUpdate();
    }

    _buildPopupMenu() {
        // Header with location
        this._locationItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._locationItem.label.style_class = 'popup-subtitle-menu-item';
        this._indicator.menu.addMenuItem(this._locationItem);

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Date header
        this._dateItem = new PopupMenu.PopupMenuItem(formatDate(new Date()), {reactive: false});
        this._dateItem.label.style_class = 'popup-subtitle-menu-item';
        this._indicator.menu.addMenuItem(this._dateItem);

        // Prayer times table
        this._prayerItems = {};
        const prayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'sunset', 'maghrib', 'isha', 'midnight'];

        for (let prayer of prayers) {
            // Create a menu item with a custom table-like layout
            let item = new PopupMenu.PopupBaseMenuItem({reactive: false});
            
            // Create a horizontal box for the table row
            let box = new St.BoxLayout({
                style_class: 'prayer-time-row',
                x_expand: true,
            });
            
            // Prayer name (left column)
            let nameLabel = new St.Label({
                text: prayer.charAt(0).toUpperCase() + prayer.slice(1),
                style_class: 'prayer-name',
                x_expand: false,
                x_align: Clutter.ActorAlign.START,
            });
            nameLabel.set_width(80); // Fixed width for alignment
            
            // Time (right column)
            let timeLabel = new St.Label({
                text: '',
                style_class: 'prayer-time',
                x_expand: true,
                x_align: Clutter.ActorAlign.END,
            });
            
            box.add_child(nameLabel);
            box.add_child(timeLabel);
            item.add_child(box);
            
            // Store references to both labels
            this._prayerItems[prayer] = {
                item: item,
                nameLabel: nameLabel,
                timeLabel: timeLabel
            };
            this._indicator.menu.addMenuItem(item);
        }

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Time left message
        this._messageItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._messageItem.label.style_class = 'popup-subtitle-menu-item';
        this._indicator.menu.addMenuItem(this._messageItem);

        this._timeLeftItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._timeLeftItem.label.style_class = 'popup-title';
        this._indicator.menu.addMenuItem(this._timeLeftItem);

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings button
        let settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        settingsItem.connect('activate', () => {
            this.openPreferences();
        });
        this._indicator.menu.addMenuItem(settingsItem);
    }

    _update() {
        // Get current location
        let location = Utils.getCurrentLocation(this._settings);
        let coords = [location.lat, location.lng];
        
        // Calculate timezone (use manual if enabled, otherwise system default)
        let timezone;
        if (this._settings.get_boolean('timezone-manual')) {
            timezone = this._settings.get_double('timezone-offset');
            if (this._settings.get_boolean('timezone-daylight')) {
                timezone += 1; // Add DST hour
            }
        } else {
            timezone = -new Date().getTimezoneOffset() / 60; // System timezone
        }
        
        let method = this._settings.get_string('calculation-method');
        
        let times = getPrayerTimes(new Date(), coords, timezone, method);
        let next = getNextPrayer(times);
        let mins = Math.round((next.time - new Date()) / 60000);
        this._label.text = `${next.name.charAt(0).toUpperCase() + next.name.slice(1)}: ${mins} min`;

        // Update popup menu
        this._updatePopupMenu();

        // Check for notifications
        if (this._settings.get_boolean('notification-enabled') && mins === 0) {
            let notifText = this._settings.get_string('notification-text');
            Main.notify(_('Prayer Time'), notifText);
        }
        
        // Pre-notification
        if (this._settings.get_boolean('prenotification-enabled')) {
            let preNotifMins = this._settings.get_int('prenotification-minutes');
            if (mins === preNotifMins) {
                Main.notify(_('Prayer Time Soon'), _('%s in %d minutes').format(
                    next.name.charAt(0).toUpperCase() + next.name.slice(1), preNotifMins));
            }
        }
    }

    _updatePopupMenu() {
        // Get current location
        let location = Utils.getCurrentLocation(this._settings);
        let coords = [location.lat, location.lng];
        
        // Calculate timezone
        let timezone;
        if (this._settings.get_boolean('timezone-manual')) {
            timezone = this._settings.get_double('timezone-offset');
            if (this._settings.get_boolean('timezone-daylight')) {
                timezone += 1;
            }
        } else {
            timezone = -new Date().getTimezoneOffset() / 60;
        }
        
        let method = this._settings.get_string('calculation-method');
        let format = this._settings.get_string('display-format') === '24-hours' ? '24h' : '12h';
        
        let times = getPrayerTimes(new Date(), coords, timezone, method);
        let next = getNextPrayer(times);

        // Update location and date
        this._locationItem.label.text = location.address;
        this._dateItem.label.text = formatDate(new Date());

        // Update prayer times - only show enabled prayers (matching Firefox structure)
        const prayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'sunset', 'maghrib', 'isha', 'midnight'];
        for (let prayer of prayers) {
            let showKey = `show-${prayer}`;
            let shouldShow = this._settings.get_boolean(showKey);
            
            if (this._prayerItems[prayer]) {
                if (shouldShow && times[prayer]) {
                    let timeStr = formatTime(times[prayer], format);
                    let isNext = (prayer === next.name);

                    this._prayerItems[prayer].timeLabel.text = timeStr;
                    this._prayerItems[prayer].item.visible = true;

                    // Highlight next prayer
                    if (isNext) {
                        this._prayerItems[prayer].nameLabel.style_class = 'prayer-name prayer-next';
                        this._prayerItems[prayer].timeLabel.style_class = 'prayer-time prayer-next';
                    } else {
                        this._prayerItems[prayer].nameLabel.style_class = 'prayer-name';
                        this._prayerItems[prayer].timeLabel.style_class = 'prayer-time';
                    }
                } else {
                    this._prayerItems[prayer].item.visible = false;
                }
            }
        }

        // Update time left message
        let minsLeft = Math.round((next.time - new Date()) / 60000);
        let timeName = next.name.charAt(0).toUpperCase() + next.name.slice(1);

        if (minsLeft > 0) {
            let timeStr = getTimeLeftString(minsLeft);
            this._messageItem.label.text = `Time to ${timeName}:`;
            this._timeLeftItem.label.text = timeStr;
        } else {
            this._messageItem.label.text = '';
            this._timeLeftItem.label.text = `Now: ${timeName}`;
        }
    }

    _scheduleNextUpdate() {
        // Calculate milliseconds until the next minute boundary
        // This ensures updates happen exactly at the start of each minute
        const OneMinute = 60000;
        const msUntilNextMinute = OneMinute - (Date.now() % OneMinute);

        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, msUntilNextMinute, () => {
            this._update();
            this._scheduleNextUpdate();
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        
        this._settings = null;
        this._indicator?.destroy();
        this._indicator = null;
    }
}