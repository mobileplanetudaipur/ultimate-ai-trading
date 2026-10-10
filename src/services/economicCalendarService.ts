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
        id: 'evt_1',
        title: 'US Core Consumer Price Index (CPI YoY)',
        currency: 'USD',
        impact: 'HIGH',
        scheduledTime: now + 35 * 60 * 1000, // in 35 mins (will trigger approaching blackout!)
        forecast: '3.2%',
        previous: '3.3%'
      },
      {
        id: 'evt_2',
        title: 'FOMC Federal Reserve Funds Rate Decision',
        currency: 'USD',
        impact: 'HIGH',
        scheduledTime: now + 180 * 60 * 1000,
        forecast: '5.25%',
        previous: '5.25%'
      },
      {
        id: 'evt_3',
        title: 'German Manufacturing PMI',
        currency: 'EUR',
        impact: 'MEDIUM',
        scheduledTime: now + 320 * 60 * 1000,
        forecast: '44.8',
        previous: '43.2'
      },
      {
        id: 'evt_4',
        title: 'Bank of Japan (BOJ) Policy Rate Statement',
        currency: 'JPY',
        impact: 'HIGH',
        scheduledTime: now + 720 * 60 * 1000,
        forecast: '0.25%',
        previous: '0.10%'
      }
    ];
  }

  public getUpcomingEvents(): EconomicEvent[] {
    return [...this.events].sort((a, b) => a.scheduledTime - b.scheduledTime);
  }

  public addEvent(event: Omit<EconomicEvent, 'id'>): EconomicEvent {
    const newEvent: EconomicEvent = {
      ...event,
      id: 'evt_' + Math.random().toString(36).substring(2, 7)
    };
    this.events.push(newEvent);
    return newEvent;
  }
}

export const economicCalendarService = new EconomicCalendarService();
