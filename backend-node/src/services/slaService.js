/**
 * Service layer for SLA Policies, Timers, and Compliance Logic
 */

import { SLARepository } from '../repositories/slaRepository.js';
import { validateSlaPolicyPayload } from '../schemas/slaSchema.js';

export class SLAService {
  /**
   * Fetch list of all configured SLA policies
   */
  static async getAllPolicies() {
    try {
      const policies = await SLARepository.getAllPolicies();
      return { policies, error: null, statusCode: 200 };
    } catch (err) {
      return { policies: [], error: err.message, statusCode: 500 };
    }
  }

  /**
   * Update SLA policy parameters with role checking
   */
  static async updatePolicy(policyId, data, userProfile) {
    const userRole = userProfile?.role || 'viewer';
    if (!['admin', 'it_admin'].includes(userRole)) {
      return {
        policy: null,
        error: 'Forbidden: Only administrators can modify SLA policies',
        statusCode: 403,
      };
    }

    const { data: cleaned, error } = validateSlaPolicyPayload(data);
    if (error) {
      return { policy: null, error, statusCode: 400 };
    }

    try {
      const existing = await SLARepository.getPolicyById(policyId);
      if (!existing) {
        return {
          policy: null,
          error: `SLA Policy with ID '${policyId}' not found`,
          statusCode: 404,
        };
      }

      const updated = await SLARepository.updatePolicy(policyId, cleaned);
      return { policy: updated, error: null, statusCode: 200 };
    } catch (err) {
      return { policy: null, error: err.message, statusCode: 500 };
    }
  }

  /**
   * Record initial response time and check response SLA compliance
   */
  static async acknowledgeIncident(incidentId, responderId) {
    try {
      const { data: updated, error } = await SLARepository.recordFirstResponse(incidentId, responderId);
      if (error === 'Incident not found') {
        return { incident: null, error, statusCode: 404 };
      }
      if (error === 'Already acknowledged') {
        return { incident: updated, error: 'Incident has already been acknowledged', statusCode: 200 };
      }
      if (!updated) {
        return { incident: null, error: 'Failed to record response timestamp', statusCode: 500 };
      }
      return { incident: updated, error: null, statusCode: 200 };
    } catch (err) {
      return { incident: null, error: err.message, statusCode: 500 };
    }
  }

  /**
   * Retrieve organization-wide SLA compliance scorecard
   */
  static async getSlaComplianceSummary() {
    try {
      const summary = await SLARepository.getSlaComplianceSummary();
      return { summary, error: null, statusCode: 200 };
    } catch (err) {
      return { summary: null, error: err.message, statusCode: 500 };
    }
  }
}
