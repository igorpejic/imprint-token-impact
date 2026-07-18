import type { CSSProperties } from "react";

type Props = {
  carbonKg: number;
  waterLitres: number;
  energyKWh: number;
  tokenVolume: number;
  paused: boolean;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function HouseholdWorld({ carbonKg, waterLitres, energyKWh, tokenVolume, paused }: Props) {
  const km = carbonKg / .171;
  const routeProgress = ((km % 32) + 32) % 32 / 32;
  const hectares = Math.max(1, Math.round(carbonKg / .7));
  const waterRemaining = 1 - clamp(waterLitres / 220);
  const powerDrain = clamp(energyKWh / 55);
  const carbonLoad = clamp(carbonKg / 12);
  const litWindows = Math.min(10, Math.floor(energyKWh / 5));
  const style = {
    "--water-remaining": waterRemaining,
    "--power-drain": powerDrain,
    "--carbon-load": carbonLoad,
    "--route-progress": `${routeProgress * 100}%`,
  } as CSSProperties;

  return <section className={"household-world" + (paused ? " is-paused" : "")} style={style}>
    <div className="world-sky"><span className="sun"/><span className="cloud cloud-a"/><span className="cloud cloud-b"/></div>
    <div className="sim-status"><span>LIVE HOUSEHOLD SIMULATION</span><b>{tokenVolume.toLocaleString("en-GB")} tokens observed</b></div>
    <div className="hectare-copy"><strong>{hectares} ha</strong><span>land-equivalent<br/>to offset emissions</span></div>
    <div className="plot" aria-label="Land plot showing resource use">
      {Array.from({ length: 30 }, (_, index) => <i key={index} className={index / 30 < carbonLoad ? "stressed" : ""}/>) }
      <div className="route-track"><span className="route-trace"/><span className="sim-car"><i/><b/><b/></span></div>
      <div className="house">
        <div className="roof"/><div className="chimney"><i/></div><div className="walls">
          <div className="windows">{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < litWindows ? "lit" : ""}/>)}</div>
          <span className="door"/>
        </div>
        <div className="power-cable"><i/><i/><i/></div>
      </div>
      <div className="water-tank"><em>WATER</em><div><i/></div><small>{Math.round(waterRemaining * 100)}% remaining</small></div>
    </div>
    <div className="sim-meters">
      <article className="meter electricity"><span><i/>House electricity</span><b>{energyKWh.toFixed(2)} kWh</b><div><i/></div><small>grid draw accumulating</small></article>
      <article className="meter water"><span><i/>Cooling water</span><b>{waterLitres.toFixed(1)} L</b><div><i/></div><small>reserve visibly draining</small></article>
      <article className="meter carbon"><span><i/>CO₂e route</span><b>{carbonKg.toFixed(2)} kg</b><div><i/></div><small>{km.toFixed(1)} km driven around the land</small></article>
    </div>
  </section>;
}
