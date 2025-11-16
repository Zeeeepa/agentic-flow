/**
 * Data Sharing Controls
 * Manages patient data sharing policies and restrictions
 */

import {
  DataSharingPolicy,
  DataRestriction
} from './types';

export class DataSharingControls {
  private policies: Map<string, DataSharingPolicy>;
  private patientPolicies: Map<string, string>; // patientId -> policyId

  constructor() {
    this.policies = new Map();
    this.patientPolicies = new Map();
  }

  /**
   * Create data sharing policy for patient
   */
  async createPolicy(policy: Omit<DataSharingPolicy, 'id'>): Promise<DataSharingPolicy> {
    const newPolicy: DataSharingPolicy = {
      ...policy,
      id: `policy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    this.policies.set(newPolicy.id, newPolicy);
    this.patientPolicies.set(policy.patientId, newPolicy.id);

    console.log(`[DATA_SHARING] Created policy ${newPolicy.id} for patient ${policy.patientId}`);

    return newPolicy;
  }

  /**
   * Update data sharing policy
   */
  async updatePolicy(policyId: string, updates: Partial<DataSharingPolicy>): Promise<boolean> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    Object.assign(policy, updates);
    console.log(`[DATA_SHARING] Updated policy ${policyId}`);

    return true;
  }

  /**
   * Check if data sharing is allowed
   */
  isDataSharingAllowed(
    patientId: string,
    providerId: string,
    dataCategory: string
  ): { allowed: boolean; reason?: string } {
    const policyId = this.patientPolicies.get(patientId);
    if (!policyId) {
      return { allowed: false, reason: 'No data sharing policy found' };
    }

    const policy = this.policies.get(policyId);
    if (!policy || !policy.active) {
      return { allowed: false, reason: 'Data sharing policy is not active' };
    }

    // Check if provider is in allowed list
    if (!policy.allowedProviders.includes(providerId)) {
      return { allowed: false, reason: 'Provider not in allowed list' };
    }

    // Check if data category is allowed
    if (!policy.dataCategories.includes(dataCategory)) {
      return { allowed: false, reason: 'Data category not allowed for sharing' };
    }

    // Check restrictions
    for (const restriction of policy.restrictions) {
      const violates = this.checkRestrictionViolation(restriction, {
        providerId,
        dataCategory,
        timestamp: new Date()
      });

      if (violates) {
        return { allowed: false, reason: restriction.description };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if restriction is violated
   */
  private checkRestrictionViolation(
    restriction: DataRestriction,
    context: { providerId: string; dataCategory: string; timestamp: Date }
  ): boolean {
    switch (restriction.type) {
      case 'time_based':
        return this.checkTimeRestriction(restriction.rules, context.timestamp);

      case 'location_based':
        // Would check provider's location against allowed locations
        return false;

      case 'purpose_based':
        // Would check if access purpose matches allowed purposes
        return false;

      default:
        return false;
    }
  }

  /**
   * Check time-based restriction
   */
  private checkTimeRestriction(rules: Record<string, any>, timestamp: Date): boolean {
    if (rules.allowedHours) {
      const hour = timestamp.getHours();
      const [start, end] = rules.allowedHours;
      if (hour < start || hour >= end) {
        return true; // Violated
      }
    }

    if (rules.allowedDays) {
      const day = timestamp.getDay();
      if (!rules.allowedDays.includes(day)) {
        return true; // Violated
      }
    }

    return false;
  }

  /**
   * Add provider to allowed list
   */
  async addAllowedProvider(patientId: string, providerId: string): Promise<boolean> {
    const policyId = this.patientPolicies.get(patientId);
    if (!policyId) {
      return false;
    }

    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    if (!policy.allowedProviders.includes(providerId)) {
      policy.allowedProviders.push(providerId);
      console.log(`[DATA_SHARING] Added provider ${providerId} to allowed list for patient ${patientId}`);
    }

    return true;
  }

  /**
   * Remove provider from allowed list
   */
  async removeAllowedProvider(patientId: string, providerId: string): Promise<boolean> {
    const policyId = this.patientPolicies.get(patientId);
    if (!policyId) {
      return false;
    }

    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    const index = policy.allowedProviders.indexOf(providerId);
    if (index > -1) {
      policy.allowedProviders.splice(index, 1);
      console.log(`[DATA_SHARING] Removed provider ${providerId} from allowed list for patient ${patientId}`);
    }

    return true;
  }

  /**
   * Add data category to policy
   */
  async addDataCategory(patientId: string, category: string): Promise<boolean> {
    const policyId = this.patientPolicies.get(patientId);
    if (!policyId) {
      return false;
    }

    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    if (!policy.dataCategories.includes(category)) {
      policy.dataCategories.push(category);
      console.log(`[DATA_SHARING] Added data category ${category} to policy for patient ${patientId}`);
    }

    return true;
  }

  /**
   * Add restriction to policy
   */
  async addRestriction(patientId: string, restriction: DataRestriction): Promise<boolean> {
    const policyId = this.patientPolicies.get(patientId);
    if (!policyId) {
      return false;
    }

    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    policy.restrictions.push(restriction);
    console.log(`[DATA_SHARING] Added restriction to policy for patient ${patientId}: ${restriction.description}`);

    return true;
  }

  /**
   * Get policy for patient
   */
  getPolicyForPatient(patientId: string): DataSharingPolicy | undefined {
    const policyId = this.patientPolicies.get(patientId);
    return policyId ? this.policies.get(policyId) : undefined;
  }

  /**
   * Activate/deactivate policy
   */
  async setPolicyActiveStatus(patientId: string, active: boolean): Promise<boolean> {
    const policyId = this.patientPolicies.get(patientId);
    if (!policyId) {
      return false;
    }

    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    policy.active = active;
    console.log(`[DATA_SHARING] Policy for patient ${patientId} ${active ? 'activated' : 'deactivated'}`);

    return true;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalPolicies: number;
    activePolicies: number;
    averageAllowedProviders: number;
    averageDataCategories: number;
    totalRestrictions: number;
  } {
    let activeCount = 0;
    let totalProviders = 0;
    let totalCategories = 0;
    let totalRestrictions = 0;

    for (const policy of this.policies.values()) {
      if (policy.active) {
        activeCount++;
      }
      totalProviders += policy.allowedProviders.length;
      totalCategories += policy.dataCategories.length;
      totalRestrictions += policy.restrictions.length;
    }

    const count = this.policies.size;

    return {
      totalPolicies: count,
      activePolicies: activeCount,
      averageAllowedProviders: count > 0 ? totalProviders / count : 0,
      averageDataCategories: count > 0 ? totalCategories / count : 0,
      totalRestrictions
    };
  }
}
