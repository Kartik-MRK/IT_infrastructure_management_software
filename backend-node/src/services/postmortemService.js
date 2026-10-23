/**
 * Service Layer for Post-Mortem Reports, 5-Whys Analysis & Markdown Export
 */

import { validatePostmortemUpdatePayload } from '../schemas/postmortemSchema.js';
import { PostMortemRepository } from '../repositories/postmortemRepository.js';

export class PostMortemService {
  /**
   * Generate or refresh automated post-mortem draft for an incident
   */
  static async generateDraft(incidentId, authorId = null) {
    try {
      const draft = await PostMortemRepository.generateDraft(incidentId, authorId);
      return { draft, error: null, statusCode: 201 };
    } catch (err) {
      return { draft: null, error: `Failed to generate post-mortem: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Fetch post-mortem document for an incident (auto-generating draft if none exists)
   */
  static async getPostmortem(incidentId, autoGenerate = true, authorId = null) {
    try {
      let doc = await PostMortemRepository.getByIncidentId(incidentId);
      if (!doc && autoGenerate) {
        doc = await PostMortemRepository.generateDraft(incidentId, authorId);
      }
      if (!doc) {
        return { postmortem: null, error: 'Post-mortem not found', statusCode: 404 };
      }
      return { postmortem: doc, error: null, statusCode: 200 };
    } catch (err) {
      return { postmortem: null, error: `Failed to retrieve post-mortem: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Update sections, 5-whys, action items, or publication status
   */
  static async updatePostmortem(incidentId, payload) {
    const { data: cleaned, error } = validatePostmortemUpdatePayload(payload);
    if (error) {
      return { postmortem: null, error, statusCode: 400 };
    }

    try {
      const updated = await PostMortemRepository.updatePostmortem(incidentId, cleaned);
      if (!updated) {
        return { postmortem: null, error: 'Post-mortem not found to update', statusCode: 404 };
      }
      return { postmortem: updated, error: null, statusCode: 200 };
    } catch (err) {
      return { postmortem: null, error: `Failed to update post-mortem: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * List all post-mortems across the infrastructure
   */
  static async listPostmortems(status = null) {
    try {
      const items = await PostMortemRepository.listPostmortems(status);
      return { postmortems: items, error: null, statusCode: 200 };
    } catch (err) {
      return { postmortems: [], error: `Failed to list post-mortems: ${err.message}`, statusCode: 500 };
    }
  }

  /**
   * Render post-mortem as a clean, standardized Markdown document
   */
  static async exportMarkdown(incidentId) {
    const { postmortem: doc, error, statusCode } = await PostMortemService.getPostmortem(
      incidentId,
      true
    );
    if (error) {
      return { markdown: null, error, statusCode };
    }

    const impact = doc.impact_summary || {};
    const rca = doc.root_cause_analysis || {};
    const whys = rca.whys || [];
    const timeline = doc.timeline_events || [];
    const actions = doc.preventative_action_items || [];

    const mdLines = [
      `# 📋 Incident Post-Mortem: ${doc.title || 'Untitled'}`,
      `**Status**: \`${(doc.status || 'draft').toUpperCase()}\` | **Severity**: \`${(impact.severity || 'medium').toUpperCase()}\` | **Total Outage**: \`${impact.duration_minutes || 0} mins\` | **SLA Met**: \`${impact.sla_breached ? 'NO (Breached)' : 'YES'}\``,
      '',
      '---',
      '',
      '## 1. Executive Summary',
      doc.executive_summary || 'No executive summary provided.',
      '',
      '## 2. Impact & Operational Metrics',
      `- **Primary Affected Asset**: \`${impact.primary_asset || 'N/A'}\``,
      `- **Category**: \`${impact.category || 'N/A'}\``,
      `- **Mean Time to Detect (MTTD)**: \`${impact.mttd_minutes || 0} mins\``,
      `- **Mean Time to Resolve (MTTR)**: \`${impact.mttr_minutes || 0} mins\``,
      '',
      '## 3. Chronological Incident Timeline',
    ];

    if (timeline && timeline.length > 0) {
      for (const ev of timeline) {
        const ts = ev.timestamp || '';
        const tTitle = ev.title || 'Milestone';
        const tDesc = ev.description || '';
        const actor = ev.actor || '';
        mdLines.push(`- **${ts}** — **${tTitle}** (${actor}): ${tDesc}`);
      }
    } else {
      mdLines.push('_No timeline milestones recorded._');
    }

    mdLines.push(
      '',
      '## 4. Root Cause Analysis (5-Whys Framework)'
    );

    if (whys && whys.length > 0) {
      whys.forEach((w, idx) => {
        mdLines.push(`${idx + 1}. ${w}`);
      });
    } else {
      mdLines.push('_5-Whys analysis not completed._');
    }

    mdLines.push(
      '',
      `**Root Cause Statement**: ${rca.root_cause_statement || 'Pending final SRE signoff.'}`,
      '',
      '## 5. Immediate Mitigation & Recovery Steps',
      doc.immediate_resolution_steps || 'Service restored to nominal operational parameters.',
      '',
      '## 6. Preventative Action Items & Corrective Tasks'
    );

    if (actions && actions.length > 0) {
      for (const act of actions) {
        const statusIcon = act.status === 'completed' ? 'x' : ' ';
        const task = act.task_description || '';
        const owner = act.owner || 'Unassigned';
        const prio = (act.priority || 'medium').toUpperCase();
        const due = act.due_date || 'None';
        mdLines.push(
          `- [${statusIcon}] **${task}** — Owner: \`${owner}\` | Priority: \`${prio}\` | Due: \`${due}\` | Status: \`${act.status || 'pending'}\``
        );
      }
    } else {
      mdLines.push('_No preventative action items assigned._');
    }

    mdLines.push('\n---\n*Generated by ITIMS SRE Incident Reliability Engine*');

    return { markdown: mdLines.join('\n'), error: null, statusCode: 200 };
  }
}
