import { EconomicEvent } from '../types/trading';

export class EconomicCalendarService {
  private events: EconomicEvent[] = [];

  constructor() {
    this.initMockEvents();
  }

  private initMockEvents() {
    const now = Date.now();
    this.events = [
      {
        id: 'scenario_evt_1',
        title: 'US Core Consumer Price Index (CPI YoY) [Testing Scenario]',
        currency: 'USD',
        impact: 'HIGH',
        scheduledTime: now + 35 * 60 * 1000, // Approaching blackout testing scenario
        forecast: '3.2%',
        previous: '3.3%',
        isSyntheticTestScenario: true
      },
      {
        id: 'scenario_evt_2',
        title: 'FOMC Federal Reserve Funds Rate Decision [Testing Scenario]',
        currency: 'USD',
        impact: 'HIGH',
        scheduledTime: now + 180 * 60 * 1000,
        forecast: '5.25%',
        previous: '5.25%',
        isSyntheticTestScenario: true
      },
      {
        id: 'scenario_evt_3',
        title: 'German Manufacturing PMI [Testing Scenario]',
        currency: 'EUR',
        impact: 'MEDIUM',
        scheduledTime: now + 320 * 60 * 1000,
        forecast: '44.8',
        previous: '43.2',
        isSyntheticTestScenario: true
      },
      {
        id: 'scenario_evt_4',
        title: 'Bank of Japan (BOJ) Policy Rate Statement [Testing Scenario]',
        currency: 'JPY',
        impact: 'HIGH',
        scheduledTime: now + 720 * 60 * 1000,
        forecast: '0.25%',
        previous: '0.10%',
        isSyntheticTestScenario: true
      }
    ];
  }

  public getUpcomingEvents(): EconomicEvent[] {
    return [...this.events].sort((a, b) => a.scheduledTime - b.scheduledTime);
  }
}

export const economicCalendarService = new EconomicCalendarService();
