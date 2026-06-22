frappe.ui.form.on('Prospect List', {
	refresh(frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__('View Prospects'), () => {
				frappe.set_route('List', 'Prospect', { prospect_list: frm.doc.name });
			});
		}
	},
});
