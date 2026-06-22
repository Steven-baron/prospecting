import frappe
from frappe.model.document import Document


class Prospect(Document):
	def before_save(self):
		if self.email_id:
			self.email_id = self.email_id.strip().lower()
