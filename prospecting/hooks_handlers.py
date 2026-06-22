import frappe


def on_crm_deal_created(doc, method):
	"""When a CRM Deal is created from a Lead, mark the source Prospect as Won."""
	if not doc.lead:
		return
	prospect_name = frappe.db.get_value('CRM Lead', doc.lead, 'custom_prospect')
	if not prospect_name:
		return
	if frappe.db.exists('Prospect', prospect_name):
		frappe.db.set_value('Prospect', prospect_name, 'status', 'Won')
