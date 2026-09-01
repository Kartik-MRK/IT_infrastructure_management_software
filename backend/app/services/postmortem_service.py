"""Service Layer for Post-Mortem Reports, 5-Whys Analysis & Markdown Export"""

from ..schemas.postmortem_schema import validate_postmortem_update_payload
from ..repositories.postmortem_repository import PostMortemRepository

class PostMortemService:
    """Encapsulates business logic for post-mortem generation, edits, and exports"""

    @staticmethod
    def generate_draft(incident_id: str, author_id: str = None):
        """Generate or refresh automated post-mortem draft for an incident"""
        try:
            draft = PostMortemRepository.generate_draft(incident_id, author_id)
            return draft, None, 201
        except Exception as err:
            return None, f"Failed to generate post-mortem: {str(err)}", 500

    @staticmethod
    def get_postmortem(incident_id: str, auto_generate: bool = True, author_id: str = None):
        """Fetch post-mortem document for an incident (auto-generating draft if none exists)"""
        try:
            doc = PostMortemRepository.get_by_incident_id(incident_id)
            if not doc and auto_generate:
                doc = PostMortemRepository.generate_draft(incident_id, author_id)
            if not doc:
                return None, "Post-mortem not found", 404
            return doc, None, 200
        except Exception as err:
            return None, f"Failed to retrieve post-mortem: {str(err)}", 500

    @staticmethod
    def update_postmortem(incident_id: str, payload: dict):
        """Update sections, 5-whys, action items, or publication status"""
        cleaned, error = validate_postmortem_update_payload(payload)
        if error:
            return None, error, 400

        try:
            updated = PostMortemRepository.update_postmortem(incident_id, cleaned)
            if not updated:
                return None, "Post-mortem not found to update", 404
            return updated, None, 200
        except Exception as err:
            return None, f"Failed to update post-mortem: {str(err)}", 500

    @staticmethod
    def list_postmortems(status: str = None):
        """List all post-mortems across the infrastructure"""
        try:
            items = PostMortemRepository.list_postmortems(status)
            return items, None, 200
        except Exception as err:
            return None, f"Failed to list post-mortems: {str(err)}", 500

    @staticmethod
    def export_markdown(incident_id: str):
        """Render post-mortem as a clean, standardized Markdown document"""
        doc, error, status = PostMortemService.get_postmortem(incident_id, auto_generate=True)
        if error:
            return None, error, status

        impact = doc.get('impact_summary') or {}
        rca = doc.get('root_cause_analysis') or {}
        whys = rca.get('whys') or []
        timeline = doc.get('timeline_events') or []
        actions = doc.get('preventative_action_items') or []

        md_lines = [
            f"# 📋 Incident Post-Mortem: {doc.get('title')}",
            f"**Status**: `{doc.get('status', 'draft').upper()}` | **Severity**: `{impact.get('severity', 'medium').upper()}` | **Total Outage**: `{impact.get('duration_minutes', 0)} mins` | **SLA Met**: `{'NO (Breached)' if impact.get('sla_breached') else 'YES'}`",
            "",
            "---",
            "",
            "## 1. Executive Summary",
            doc.get('executive_summary') or "No executive summary provided.",
            "",
            "## 2. Impact & Operational Metrics",
            f"- **Primary Affected Asset**: `{impact.get('primary_asset', 'N/A')}`",
            f"- **Category**: `{impact.get('category', 'N/A')}`",
            f"- **Mean Time to Detect (MTTD)**: `{impact.get('mttd_minutes', 0)} mins`",
            f"- **Mean Time to Resolve (MTTR)**: `{impact.get('mttr_minutes', 0)} mins`",
            "",
            "## 3. Chronological Incident Timeline",
        ]

        if timeline:
            for ev in timeline:
                ts = ev.get('timestamp', '')
                t_title = ev.get('title', 'Milestone')
                t_desc = ev.get('description', '')
                actor = ev.get('actor', '')
                md_lines.append(f"- **{ts}** — **{t_title}** ({actor}): {t_desc}")
        else:
            md_lines.append("_No timeline milestones recorded._")

        md_lines.extend([
            "",
            "## 4. Root Cause Analysis (5-Whys Framework)",
        ])

        if whys:
            for idx, w in enumerate(whys, start=1):
                md_lines.append(f"{idx}. {w}")
        else:
            md_lines.append("_5-Whys analysis not completed._")

        md_lines.extend([
            "",
            f"**Root Cause Statement**: {rca.get('root_cause_statement', 'Pending final SRE signoff.')}",
            "",
            "## 5. Immediate Mitigation & Recovery Steps",
            doc.get('immediate_resolution_steps') or "Service restored to nominal operational parameters.",
            "",
            "## 6. Preventative Action Items & Corrective Tasks",
        ])

        if actions:
            for act in actions:
                status_icon = "x" if act.get('status') == 'completed' else " "
                task = act.get('task_description', '')
                owner = act.get('owner', 'Unassigned')
                prio = act.get('priority', 'medium').upper()
                due = act.get('due_date', 'None')
                md_lines.append(f"- [{status_icon}] **{task}** — Owner: `{owner}` | Priority: `{prio}` | Due: `{due}` | Status: `{act.get('status', 'pending')}`")
        else:
            md_lines.append("_No preventative action items assigned._")

        md_lines.append("\n---\n*Generated by ITIMS SRE Incident Reliability Engine*")
        return "\n".join(md_lines), None, 200
