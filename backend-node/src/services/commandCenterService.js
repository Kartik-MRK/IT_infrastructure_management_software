/**
 * Service Layer for Executive Analytics & SRE Command Center
 */

import { CommandCenterRepository } from '../repositories/commandCenterRepository.js';

export class CommandCenterService {
  /**
   * Fetch unified multi-pillar metrics
   */
  static async getMetrics() {
    try {
      const metrics = await CommandCenterRepository.getCommandCenterMetrics();
      return { data: metrics, error: null, statusCode: 200 };
    } catch (err) {
      return { data: null, error: `Failed to retrieve executive command center metrics: ${err.message}`, statusCode: 500 };
    }
  }
}
