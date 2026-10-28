import type { ReactNode } from 'react';
import type { Item, Cat } from '../lib/model';
import { dDay, catOf } from '../lib/model';
import type { Status } from '../lib/hours';

export const Ic = ({ n, className = '' }: { n: string; className?: string }) => (
  <svg className={`i ${className}`} aria-hidden="true"><use href={`#i-${n}`} /></svg>
);

export const isUnsure = (it: Item) => (it.t === 'm' ? it.status === 'unconf' : !it.h);
/** Per winkelsoort: naam (één, meer) en icoon. De kleur staat in design.css (.c-<soort>). */
export const CAT: Record<Cat, [string, string, string]> = {
  kringloop: ['Kringloop', 'Kringlopen', 'tag'],
  antiek: ['Antiek en brocante', 'Antiek en brocante', 'vase'],
  kleding: ['Vintage en kleding', 'Vintage en kleding', 'hanger'],
  schroot: ['Sloop en restpartijen', 'Sloop en restpartijen', 'hammer'],
  pandjeshuis: ['Opkoop en pandjeshuis', 'Opkoop en pandjeshuis', 'gem'],
  vlooienmarkt: ['Vlooienmarkt (vaste plek)', 'Vaste vlooienmarkten', 'kraam'],
  tweedehands: ['Tweedehandswinkel', 'Overige tweedehands', 'store'],
};
export const catCls = (it: Item) => (it.t === 'k' ? ` c-${catOf(it)}` : '');
export const kindIcon = (it: Item) => it.t === 'm' ? 'kraam' : CAT[catOf(it)][2];
/** Bewegingen uit het ontwerp (DESIGN.md). CSS-animaties volgen prefers-reduced-motion al; dit is voor JS-animaties. */
export const EASE = 'cubic-bezier(0.22,1,0.36,1)';
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Laat een knop even wippen (+ stop, hartje): klasse eraf, reflow, klasse erop. */
export const pop = (el: HTMLElement) => { if (reduced()) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };
export const kindLabel = (it: Item) => (it.t === 'm' ? it.kind : CAT[catOf(it)][0]);

export function Tile({ it, small }: { it: Item; small?: boolean }) {
  const cls = `tile ${it.t}${isUnsure(it) ? ' unconf' : ''}${it.t === 'm' && it.status === 'cancel' ? ' cancel' : ''}${catCls(it)}`;
  return <span className={cls} title={kindLabel(it)} style={small ? { width: 24, height: 24 } : undefined}><Ic n={kindIcon(it)} /></span>;
}

export const St = ({ s, pulse }: { s: Status; pulse?: boolean }) => (
  <span className={`st ${s.cls}${pulse && s.open ? ' pulse' : ''}`}><i /><span>{s.txt}</span></span>
);

const CONF = { org: ['org', 'check', 'Bevestigd'], chk: ['chk', 'check', 'Gecontroleerd'], unconf: ['unconf', 'alert', 'Nog niet bevestigd'] } as const;
export function Conf({ it }: { it: Item }) {
  if (it.t !== 'm' || it.status === 'cancel') return null;
  const [cls, icon, txt] = CONF[it.status];
  return <span className={`conf ${cls}`}><Ic n={icon} />{it.status === 'chk' && it.checked ? `Gecontroleerd ${dDay(it.checked)}` : txt}</span>;
}

export const Banner = ({ kind = '', icon, children }: { kind?: string; icon: string; children: ReactNode }) => (
  <div className={`banner ${kind}`}><Ic n={icon} /><span>{children}</span></div>
);
