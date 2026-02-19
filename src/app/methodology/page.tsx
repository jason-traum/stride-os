import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Methodology | Dreamy',
  description: 'How Dreamy calculates weather-adjusted pace, elevation corrections, and VDOT estimates.',
};

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <div>
        <Link href="/today" className="text-sm text-textTertiary hover:text-textSecondary flex items-center gap-1 mb-4">
          <ChevronLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-3xl font-bold text-textPrimary">Methodology</h1>
        <p className="text-textSecondary mt-2">
          How Dreamy adjusts pace for weather and terrain conditions. Our approach is deliberately
          conservative &mdash; we&apos;d rather understate an adjustment than overstate it.
        </p>
      </div>

      {/* Weather Pace Adjustment */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-textPrimary border-b border-borderPrimary pb-2">
          Weather Pace Adjustment
        </h2>

        <div className="space-y-3 text-sm text-textSecondary leading-relaxed">
          <p>
            Heat is the largest environmental factor in running performance. When it&apos;s warmer than optimal,
            your body diverts blood flow from working muscles to the skin for cooling. This reduces oxygen
            delivery and increases cardiac strain, making the same pace require more effort.
          </p>

          <h3 className="text-base font-medium text-textPrimary mt-6">Optimal Temperature</h3>
          <p>
            We use <strong>50&deg;F (10&deg;C)</strong> as the optimal racing temperature for recreational runners.
            This is deliberately conservative &mdash; research suggests elite marathoners peak around 39&ndash;46&deg;F,
            while recreational runners peak around 43&ndash;55&deg;F.
          </p>
          <p className="text-xs text-textTertiary">
            El Helou et al. 2012, &ldquo;Impact of Environmental Parameters on Marathon Running Performance,&rdquo;
            PLOS ONE. Analysis of 1.8 million marathon finishers.
          </p>

          <h3 className="text-base font-medium text-textPrimary mt-6">Heat Penalty Tiers</h3>
          <div className="bg-bgSecondary rounded-lg border border-borderPrimary p-4 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-textTertiary border-b border-borderSecondary pb-2">
              <span>Temperature Range</span>
              <span>Rate</span>
              <span>Example</span>
            </div>
            <Row range="50&ndash;70&deg;F" rate="0.4 sec/mi per &deg;F" example="60&deg;F &rarr; +4 sec/mi" />
            <Row range="70&ndash;85&deg;F" rate="1.0 sec/mi per &deg;F" example="80&deg;F &rarr; +18 sec/mi" />
            <Row range="85&deg;F+" rate="1.5 sec/mi per &deg;F" example="95&deg;F &rarr; +38 sec/mi" />
          </div>
          <p>
            The escalating tiers reflect the non-linear nature of heat stress. At moderate temperatures,
            thermoregulation is efficient. Above 70&deg;F, the body struggles to dissipate heat fast enough.
            Above 85&deg;F, physiological strain increases sharply.
          </p>
          <p className="text-xs text-textTertiary">
            Mantzios et al. 2022, &ldquo;Effects of Weather Parameters on Endurance Running Performance,&rdquo;
            Medicine &amp; Science in Sports &amp; Exercise. Found 0.3&ndash;0.4% performance decline per 1&deg;C
            outside optimal. Our mild zone rate (0.4 sec/mi per &deg;F) is deliberately below the mean
            research value (~0.7&ndash;1.0 sec/mi) to stay conservative.
          </p>

          <h3 className="text-base font-medium text-textPrimary mt-6">Humidity</h3>
          <p>
            Humidity only affects performance when the body needs aggressive evaporative cooling &mdash; which
            doesn&apos;t happen at moderate temperatures. We apply a humidity modifier <strong>only above
            65&deg;F</strong>, adding 0.1 sec/mi for each percentage point of humidity above 50%.
          </p>
          <p className="text-xs text-textTertiary">
            Periard et al. 2021, &ldquo;Delineating the impacts of air temperature and humidity for endurance
            exercise.&rdquo; Found humidity had negligible independent effect below ~65&deg;F.
          </p>

          <h3 className="text-base font-medium text-textPrimary mt-6">Cold</h3>
          <p>
            Cold has a much smaller effect than heat and is partially mitigable by clothing.
            We apply a minor penalty (0.2 sec/mi per &deg;F) below 35&deg;F.
          </p>
          <p className="text-xs text-textTertiary">
            Castellani &amp; Tipton 2015 review. The research consensus is that &ldquo;a little too cold
            is much better than a little too hot.&rdquo;
          </p>

          <h3 className="text-base font-medium text-textPrimary mt-6">Mid-Race Temperature</h3>
          <p>
            For longer workouts, we use the weather at the midpoint of the run rather than the start.
            A marathon starting at 7am in 55&deg;F will be significantly warmer by mile 20. The
            mid-race hour better captures the conditions your body actually raced in.
          </p>
        </div>
      </section>

      {/* Elevation Adjustment */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-textPrimary border-b border-borderPrimary pb-2">
          Elevation Adjustment
        </h2>

        <div className="space-y-3 text-sm text-textSecondary leading-relaxed">
          <p>
            Running uphill requires more energy per stride. We apply a correction of approximately
            <strong> 12 seconds per mile for every 100 feet of elevation gain per mile</strong>.
            This is a simplified linear approximation of the non-linear Minetti energy cost curve.
          </p>
          <p className="text-xs text-textTertiary">
            Minetti et al. 2002, &ldquo;Energy cost of walking and running at extreme uphill and downhill
            slopes,&rdquo; Journal of Applied Physiology. Jack Daniels&apos; Running Formula suggests
            12&ndash;15 seconds per mile per 1% gradient.
          </p>

          <h3 className="text-base font-medium text-textPrimary mt-6">What This Means</h3>
          <div className="bg-bgSecondary rounded-lg border border-borderPrimary p-4 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-textTertiary border-b border-borderSecondary pb-2">
              <span>Elevation Gain/Mile</span>
              <span>Pace Penalty</span>
              <span>Example Course</span>
            </div>
            <Row range="50 ft/mi" rate="+6 sec/mi" example="Gently rolling" />
            <Row range="100 ft/mi" rate="+12 sec/mi" example="Moderately hilly" />
            <Row range="200 ft/mi" rate="+24 sec/mi" example="Very hilly / trail" />
          </div>
          <p>
            The adjustment is applied uniformly across the workout. A future improvement would use
            per-segment grade data from GPS streams for more precise correction.
          </p>
        </div>
      </section>

      {/* VDOT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-textPrimary border-b border-borderPrimary pb-2">
          Adjusted VDOT
        </h2>

        <div className="space-y-3 text-sm text-textSecondary leading-relaxed">
          <p>
            VDOT (a measure of running fitness from Jack Daniels&apos; Running Formula) is calculated
            from race distance and time. Raw VDOT penalizes you for running in heat or on hills &mdash;
            conditions outside your control.
          </p>
          <p>
            We calculate <strong>adjusted VDOT</strong> by first correcting your finish time to
            estimate what you would have run on a flat course in ideal weather (50&deg;F, low humidity).
            The weather and elevation corrections above are subtracted from your actual time before
            computing VDOT. This gives a more accurate picture of your fitness.
          </p>
          <p>
            A safety cap prevents adjustments from reducing time by more than 15%, guarding against
            extreme or erroneous weather data producing unrealistic VDOT values.
          </p>
        </div>
      </section>

      {/* Example calculations */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-textPrimary border-b border-borderPrimary pb-2">
          Example Calculations
        </h2>

        <div className="bg-bgSecondary rounded-lg border border-borderPrimary p-4 space-y-4 text-sm">
          <Example
            title="59&deg;F, 74% humidity"
            steps={[
              'Temperature: (59 - 50) &times; 0.4 = 3.6 sec/mi',
              'Humidity: below 65&deg;F threshold, no adjustment',
              'Total: ~4 sec/mi',
            ]}
            note="On a 3:10 marathon (~7:15/mi), this is a 1.7-minute total adjustment."
          />
          <Example
            title="78&deg;F, 65% humidity"
            steps={[
              'Temperature: (70 - 50) &times; 0.4 + (78 - 70) &times; 1.0 = 8 + 8 = 16 sec/mi',
              'Humidity: (65 - 50) &times; 0.1 = 1.5 sec/mi',
              'Total: ~18 sec/mi',
            ]}
            note="On a 3:10 marathon, this is an 8-minute adjustment &mdash; you effectively ran a 3:02 effort."
          />
          <Example
            title="90&deg;F, 70% humidity"
            steps={[
              'Temperature: (70 - 50) &times; 0.4 + (85 - 70) &times; 1.0 + (90 - 85) &times; 1.5 = 8 + 15 + 7.5 = 30.5',
              'Humidity: (70 - 50) &times; 0.1 = 2',
              'Total: ~33 sec/mi',
            ]}
            note="Brutal conditions. A 3:40 marathon in this heat reflects roughly 3:10 fitness."
          />
        </div>
      </section>

      {/* Limitations */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-textPrimary border-b border-borderPrimary pb-2">
          Limitations &amp; Caveats
        </h2>

        <ul className="space-y-2 text-sm text-textSecondary list-disc pl-5">
          <li>
            These adjustments are population-level averages. Individual responses vary based on
            body composition, heat acclimatization, hydration, and genetics.
          </li>
          <li>
            The formula uses air temperature and relative humidity from weather stations.
            On-course conditions (sun exposure, wind, shade) can differ significantly.
          </li>
          <li>
            Elevation correction uses total workout gain, not per-segment grade. Courses with
            steep climbs followed by descents may have different net effects than steady inclines.
          </li>
          <li>
            Humidity&apos;s effect below 65&deg;F is treated as zero. Some runners may notice
            a subjective difference, but the research does not support a measurable performance impact.
          </li>
          <li>
            Heat acclimatization (adaptation from training in heat over weeks) is not yet modeled.
            An acclimatized runner is less affected than these adjustments suggest.
          </li>
          <li>
            Race distance matters: heat affects marathon performance more than 5K performance
            due to longer exposure and greater thermoregulatory demand.
            A future update will incorporate distance-specific adjustment scaling.
          </li>
        </ul>
      </section>

      {/* Sources */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-textPrimary border-b border-borderPrimary pb-2">
          Sources
        </h2>

        <ol className="space-y-2 text-xs text-textTertiary list-decimal pl-5">
          <li>
            Ely MR, Cheuvront SN, Roberts WO, Montain SJ. &ldquo;Impact of weather on marathon-running
            performance.&rdquo; <em>Medicine &amp; Science in Sports &amp; Exercise</em>, 2007;39(3):487&ndash;493.
          </li>
          <li>
            El Helou N, et al. &ldquo;Impact of Environmental Parameters on Marathon Running Performance.&rdquo;
            <em>PLOS ONE</em>, 2012. 1.8M marathon finishers from 6 World Marathon Majors.
          </li>
          <li>
            Mantzios K, et al. &ldquo;Effects of Weather Parameters on Endurance Running Performance:
            Discipline-specific Analysis of 1258 Races.&rdquo; <em>Med Sci Sports Exerc</em>, 2022.
          </li>
          <li>
            Periard JD, et al. &ldquo;Delineating the impacts of air temperature and humidity for
            endurance exercise.&rdquo; <em>Experimental Physiology</em>, 2021.
          </li>
          <li>
            Minetti AE, et al. &ldquo;Energy cost of walking and running at extreme uphill and downhill
            slopes.&rdquo; <em>Journal of Applied Physiology</em>, 2002;93(3):1039&ndash;1046.
          </li>
          <li>
            Castellani JW, Tipton MJ. &ldquo;Cold Stress Effects on Exposure Tolerance and Exercise
            Performance.&rdquo; <em>Comprehensive Physiology</em>, 2015.
          </li>
          <li>
            Daniels J. <em>Daniels&apos; Running Formula</em>, 3rd Edition. Human Kinetics, 2013.
          </li>
        </ol>
      </section>

      <div className="text-xs text-textTertiary pt-4 border-t border-borderSecondary">
        Last updated February 2026. Formula version 3.
      </div>
    </div>
  );
}

function Row({ range, rate, example }: { range: string; rate: string; example: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="text-textPrimary" dangerouslySetInnerHTML={{ __html: range }} />
      <span className="text-textSecondary">{rate}</span>
      <span className="text-textTertiary" dangerouslySetInnerHTML={{ __html: example }} />
    </div>
  );
}

function Example({ title, steps, note }: { title: string; steps: string[]; note: string }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-textPrimary" dangerouslySetInnerHTML={{ __html: title }} />
      <ul className="space-y-0.5 pl-4 text-textSecondary">
        {steps.map((step, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
        ))}
      </ul>
      <p className="text-xs text-textTertiary" dangerouslySetInnerHTML={{ __html: note }} />
    </div>
  );
}
