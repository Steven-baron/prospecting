frappe.ui.form.on('Prospect', {
	refresh(frm) {
		if (!frm.is_new()) {
			// Find Email button when website present but email missing
			if (frm.doc.website && !frm.doc.email_id) {
				frm.add_custom_button(__('Find Email'), () => {
					frm.set_intro(__('Searching for email…'), 'blue');
					frappe.call({
						method: 'prospecting.api.enrich_email',
						args: { prospect: frm.doc.name },
						callback(r) {
							frm.clear_intro();
							if (r.message && r.message.email) {
								frm.set_value('email_id', r.message.email);
								frm.save();
								frappe.show_alert({ message: __('Found: ') + r.message.email, indicator: 'green' });
							} else {
								frappe.show_alert({ message: r.message.reason || __('No email found.'), indicator: 'orange' });
							}
						},
					});
				});
			}

			// Google Maps link when coordinates or map URI available
			if (frm.doc.google_maps_uri) {
				frm.add_custom_button(__('Open in Google Maps'), () => {
					window.open(frm.doc.google_maps_uri, '_blank');
				}, __('Links'));
			}
		}
	},

	status(frm) {
		if (frm.doc.status === 'Dismissed') {
			frm.set_value('next_follow_up', null);
		}
	},
});
