import { describe, it, expect } from 'vitest';
import { ProviderBridge } from '../../src/core/provider-bridge.js';

describe('ProviderBridge', () => {
  describe('isSimulation', () => {
    it('returns false before auto-selection', () => {
      const bridge = new ProviderBridge();
      // Before any selection, default is false
      expect(bridge.isSimulation()).toBe(false);
    });

    it('returns true after setting simulation provider', async () => {
      const bridge = new ProviderBridge();
      await bridge.setProvider('simulation');
      expect(bridge.isSimulation()).toBe(true);
    });
  });

  describe('simulation mode responses', () => {
    it('returns simulated: true on responses', async () => {
      const bridge = new ProviderBridge();
      await bridge.setProvider('simulation');
      const response = await bridge.send('review this code');
      expect(response.simulated).toBe(true);
    });

    it('includes simulation notice in content', async () => {
      const bridge = new ProviderBridge();
      await bridge.setProvider('simulation');
      const response = await bridge.send('review this code');
      expect(response.content).toContain('SIMULATION');
      expect(response.content).toContain('simulated');
    });

    it('returns valid JSON content', async () => {
      const bridge = new ProviderBridge();
      await bridge.setProvider('simulation');
      const response = await bridge.send('review this code');
      const parsed = JSON.parse(response.content);
      expect(parsed.simulated).toBe(true);
      expect(parsed._simulation_notice).toBeTruthy();
      expect(parsed._install_help).toBeTruthy();
    });

    it('returns review-shaped response for review prompts', async () => {
      const bridge = new ProviderBridge();
      await bridge.setProvider('simulation');
      const response = await bridge.send('review this code');
      const parsed = JSON.parse(response.content);
      expect(parsed.issues).toBeDefined();
      expect(parsed.score).toBeDefined();
    });

    it('returns debug-shaped response for debug prompts', async () => {
      const bridge = new ProviderBridge();
      await bridge.setProvider('simulation');
      const response = await bridge.send('debug this error');
      const parsed = JSON.parse(response.content);
      expect(parsed.diagnosis).toBeDefined();
      expect(parsed.rootCause).toBeDefined();
    });

    it('returns test-shaped response for test prompts', async () => {
      const bridge = new ProviderBridge();
      await bridge.setProvider('simulation');
      const response = await bridge.send('generate tests');
      const parsed = JSON.parse(response.content);
      expect(parsed.tests).toBeDefined();
    });
  });

  describe('getProviderInfo', () => {
    it('returns simulation provider info when in simulation mode', async () => {
      const bridge = new ProviderBridge();
      await bridge.setProvider('simulation');
      const info = bridge.getProviderInfo();
      expect(info.id).toBe('simulation');
      expect(info.name).toBe('Simulation Mode');
    });
  });

  describe('setProvider', () => {
    it('throws for unknown provider', async () => {
      const bridge = new ProviderBridge();
      await expect(bridge.setProvider('nonexistent')).rejects.toThrow('Unknown provider');
    });
  });
});
