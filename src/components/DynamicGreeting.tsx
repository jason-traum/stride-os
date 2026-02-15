'use client';

import { useState, useEffect } from 'react';

interface DynamicGreetingProps {
  name?: string | null;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ==================== Holiday Calendar ====================

interface Holiday {
  name: string;
  emoji: string;
  greeting?: string; // Override greeting text (default: "Happy {name}")
}

// Fixed-date holidays (month is 1-indexed)
const FIXED_HOLIDAYS: Record<string, Holiday> = {
  // ---- JANUARY ----
  '1-1':   { name: "New Year's Day", emoji: '🎆🥂', greeting: "Happy New Year" },
  '1-27':  { name: 'National Chocolate Cake Day', emoji: '🍫🎂' },

  // ---- FEBRUARY ----
  '2-2':   { name: 'Groundhog Day', emoji: '🦫🕳️' },
  '2-9':   { name: 'National Pizza Day', emoji: '🍕🔥' },
  '2-14':  { name: "Valentine's Day", emoji: '💘😍' },
  '2-22':  { name: 'National Margarita Day', emoji: '🍹🧂' },
  '2-29':  { name: 'Leap Day', emoji: '🐸✨', greeting: "It's Leap Day — bonus day, bonus miles" },

  // ---- MARCH ----
  '3-6':   { name: 'National Oreo Day', emoji: '🍪🥛' },
  '3-14':  { name: 'Pi Day', emoji: '🥧🤓' },
  '3-17':  { name: "St. Patrick's Day", emoji: '🍀🍺' },
  '3-21':  { name: 'First Day of Spring', emoji: '🌸🌼', greeting: 'Happy first day of spring' },
  '3-23':  { name: 'National Puppy Day', emoji: '🐶🐾' },

  // ---- APRIL ----
  '4-1':   { name: "April Fools' Day", emoji: '🃏😜', greeting: "Watch your back — it's April Fools'" },
  '4-7':   { name: 'National Beer Day', emoji: '🍺🎉' },
  '4-10':  { name: 'National Siblings Day', emoji: '👫🤪' },
  '4-15':  { name: 'Tax Day', emoji: '💸😩', greeting: "Happy Tax Day — at least running is free" },
  '4-22':  { name: 'Earth Day', emoji: '🌍💚' },

  // ---- MAY ----
  '5-4':   { name: 'Star Wars Day', emoji: '⚔️🌌', greeting: 'May the 4th be with you' },
  '5-5':   { name: 'Cinco de Mayo', emoji: '🇲🇽🌮', greeting: 'Feliz Cinco de Mayo' },
  '5-16':  { name: 'National BBQ Day', emoji: '🔥🍖' },
  '5-25':  { name: 'National Wine Day', emoji: '🍷🍇' },
  '5-28':  { name: 'National Hamburger Day', emoji: '🍔🔥' },

  // ---- JUNE ----
  '6-10':  { name: 'National Iced Tea Day', emoji: '🧊🍵' },
  '6-21':  { name: 'First Day of Summer', emoji: '☀️🕶️', greeting: 'Happy first day of summer' },
  '6-27':  { name: 'National Sunglasses Day', emoji: '🕶️😎' },

  // ---- JULY ----
  '7-1':   { name: 'Hot Girl Summer', emoji: '🔥💅', greeting: "It's officially hot girl summer" },
  '7-4':   { name: 'Independence Day', emoji: '🇺🇸🎆', greeting: 'Happy 4th of July' },
  '7-7':   { name: 'World Chocolate Day', emoji: '🍫🤤' },
  '7-17':  { name: 'World Emoji Day', emoji: '🤪📱' },
  '7-21':  { name: 'National Junk Food Day', emoji: '🍟🍭' },
  '7-30':  { name: 'International Friendship Day', emoji: '🤝💛' },

  // ---- AUGUST ----
  '8-3':   { name: 'National Watermelon Day', emoji: '🍉😋' },
  '8-8':   { name: 'International Cat Day', emoji: '🐱😼' },
  '8-10':  { name: 'National Lazy Day', emoji: '😴🛋️', greeting: "It's National Lazy Day — rest day approved" },
  '8-15':  { name: 'National Relaxation Day', emoji: '😌🏖️' },
  '8-26':  { name: 'National Dog Day', emoji: '🐕🦴' },

  // ---- SEPTEMBER ----
  '9-5':   { name: 'National Cheese Pizza Day', emoji: '🍕🧀' },
  '9-18':  { name: 'National Cheeseburger Day', emoji: '🍔🧀' },
  '9-19':  { name: 'Talk Like a Pirate Day', emoji: '🏴‍☠️🦜', greeting: "Arrr — it's Talk Like a Pirate Day" },
  '9-22':  { name: 'First Day of Fall', emoji: '🍂🍁', greeting: 'Happy first day of fall' },
  '9-29':  { name: 'National Coffee Day', emoji: '☕🫠' },

  // ---- OCTOBER ----
  '10-4':  { name: 'National Taco Day', emoji: '🌮🔥' },
  '10-14': { name: 'National Dessert Day', emoji: '🍰🧁' },
  '10-31': { name: 'Halloween', emoji: '🎃👻', greeting: 'Happy Halloween' },

  // ---- NOVEMBER ----
  '11-3':  { name: 'National Sandwich Day', emoji: '🥪😤' },
  '11-11': { name: "Veterans Day", emoji: '🎖️🇺🇸' },

  // ---- DECEMBER ----
  '12-4':  { name: 'National Cookie Day', emoji: '🍪🤤' },
  '12-21': { name: 'First Day of Winter', emoji: '❄️⛄', greeting: 'Happy first day of winter' },
  '12-24': { name: 'Christmas Eve', emoji: '🎄✨' },
  '12-25': { name: 'Christmas', emoji: '🎄🎅', greeting: 'Merry Christmas' },
  '12-31': { name: "New Year's Eve", emoji: '🎉🥂' },
};

// Running-specific fun days
const RUNNING_DAYS: Record<string, Holiday> = {
  '6-7':   { name: 'Global Running Day', emoji: '🏃‍♂️🌎', greeting: "It's Global Running Day — get out there" },
  '10-1':  { name: 'marathon season!', emoji: '🏅🍂', greeting: "It's marathon season" },
};

/**
 * Get the Nth occurrence of a weekday in a given month/year.
 * weekday: 0=Sun, 1=Mon, ... 6=Sat
 * n: 1-based (1=first, -1=last)
 */
function getNthWeekday(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) {
    const first = new Date(year, month - 1, 1);
    let day = 1 + ((weekday - first.getDay() + 7) % 7);
    day += (n - 1) * 7;
    return day;
  } else {
    // Last occurrence
    const last = new Date(year, month, 0); // Last day of month
    let day = last.getDate() - ((last.getDay() - weekday + 7) % 7);
    return day;
  }
}

/**
 * Get floating holidays for a given year.
 * These change date every year (e.g., Thanksgiving = 4th Thursday of Nov).
 */
function getFloatingHolidays(year: number): Record<string, Holiday> {
  const holidays: Record<string, Holiday> = {};

  // Presidents' Day — 3rd Monday of February
  const presDay = getNthWeekday(year, 2, 1, 3);
  holidays[`2-${presDay}`] = { name: "Presidents' Day", emoji: '🇺🇸' };

  // Mother's Day — 2nd Sunday of May
  const mothersDay = getNthWeekday(year, 5, 0, 2);
  holidays[`5-${mothersDay}`] = { name: "Mother's Day", emoji: '💐💕', greeting: "Happy Mother's Day" };

  // Memorial Day — last Monday of May
  const memorialDay = getNthWeekday(year, 5, 1, -1);
  holidays[`5-${memorialDay}`] = { name: 'Memorial Day', emoji: '🇺🇸🎖️' };

  // National Donut Day — 1st Friday of June
  const donutDay = getNthWeekday(year, 6, 5, 1);
  holidays[`6-${donutDay}`] = { name: 'National Donut Day', emoji: '🍩🤤' };

  // Father's Day — 3rd Sunday of June
  const fathersDay = getNthWeekday(year, 6, 0, 3);
  holidays[`6-${fathersDay}`] = { name: "Father's Day", emoji: '👔🍺', greeting: "Happy Father's Day" };

  // National Ice Cream Day — 3rd Sunday of July
  const iceCreamDay = getNthWeekday(year, 7, 0, 3);
  holidays[`7-${iceCreamDay}`] = { name: 'National Ice Cream Day', emoji: '🍦🤤' };

  // Labor Day — 1st Monday of September
  const laborDay = getNthWeekday(year, 9, 1, 1);
  holidays[`9-${laborDay}`] = { name: 'Labor Day', emoji: '💪😎' };

  // Thanksgiving — 4th Thursday of November
  const thanksgiving = getNthWeekday(year, 11, 4, 4);
  holidays[`11-${thanksgiving}`] = { name: 'Thanksgiving', emoji: '🦃🍽️', greeting: 'Happy Thanksgiving' };

  // Day after Thanksgiving
  holidays[`11-${thanksgiving + 1}`] = { name: 'Black Friday', emoji: '🛍️💸', greeting: 'Happy Black Friday — skip the mall, go for a run' };

  // Easter (Computus algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  holidays[`${month}-${day}`] = { name: 'Easter', emoji: '🐣🌷', greeting: 'Happy Easter' };

  return holidays;
}

function getTodayHoliday(): Holiday | null {
  const now = new Date();
  const key = `${now.getMonth() + 1}-${now.getDate()}`;
  const year = now.getFullYear();

  // Check fixed holidays first
  if (FIXED_HOLIDAYS[key]) return FIXED_HOLIDAYS[key];

  // Check running days
  if (RUNNING_DAYS[key]) return RUNNING_DAYS[key];

  // Check floating holidays
  const floating = getFloatingHolidays(year);
  if (floating[key]) return floating[key];

  return null;
}

function getFullGreeting(): { timeGreeting: string; holidayLine: string | null } {
  const timeGreeting = getTimeGreeting();
  const holiday = getTodayHoliday();

  if (!holiday) return { timeGreeting, holidayLine: null };

  const text = holiday.greeting || `Happy ${holiday.name}`;
  return {
    timeGreeting,
    holidayLine: `${text} ${holiday.emoji}`,
  };
}

export function DynamicGreeting({ name }: DynamicGreetingProps) {
  const [greeting, setGreeting] = useState<{ timeGreeting: string; holidayLine: string | null }>({ timeGreeting: '', holidayLine: null });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setGreeting(getFullGreeting());
    setMounted(true);

    const interval = setInterval(() => {
      setGreeting(getFullGreeting());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return <span className="inline-block min-w-[140px]">&nbsp;</span>;
  }

  return (
    <span>
      {greeting.timeGreeting}{name ? `, ${name}` : ''}!
      {greeting.holidayLine && (
        <span className="block text-base font-normal text-textSecondary mt-0.5">
          {greeting.holidayLine}
        </span>
      )}
    </span>
  );
}
