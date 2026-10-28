// Soort winkel (§14.4). "Kringloop" alleen als naam, keten of eigen website het zegt; anders eerlijk "tweedehands",
// met waar het kan een nadere soort (sub) uit de naam. ponytail: regels op naam; een beheerqueue verbetert de rest later.
const KRINGLOOP = /kringlo(op|per|ods)|kringkoop|ringloop|kringwinkel|ecokring|het goed|woord (en|&) daad|2switch|emmaus|rataplan|reshare|humana|snuffel|weggeef|ruilwinkel|goede doel|opnieuw (&|en) co|estafette/i;
const CHARITY = /dorcas|terres? des hommes|leger des heils|leprawinkel|rode kruis/i;
// Eigen website zegt kringloop (kringloopteddy.eu, opnieuwenco.nl/kringloopwinkels/…). Gidssites tellen niet: die noemen iedereen kringloop.
const KRINGLOOP_SITE = /kringlo|kringwinkel/i, GUIDE = /allekringloopwinkels|kringloop-info|kringloopwinkels\.nu|kringloopzoeker/i;
const SUB_BY_NAME = [
  ['kleding', /vintage|thrift|fashion|kleding|clothing|boetiek|boutique|pre-?loved|pre-?owned/i],
  ['pandjeshuis', /used products|cash converters|\binkoop\b/i],
  ['schroot', /bouwmateria|sloop|restpartij|houtbank/i],
];

export const kindOf = t => t.shop === 'charity' || CHARITY.test(t.name || '') ? 'goede-doelen' : KRINGLOOP.test(t.name || '') ? 'kringloop' : 'tweedehands';

/** Na het samenvoegen (website kan uit Overture komen): kringloop volgens eigen site, anders nadere soort uit de naam. */
export function refine(p) {
  if (p.kind !== 'tweedehands') return p;
  if (p.website && KRINGLOOP_SITE.test(p.website) && !GUIDE.test(p.website)) { p.kind = 'kringloop'; delete p.sub; return p; }
  p.sub ??= SUB_BY_NAME.find(([, re]) => re.test(p.name))?.[0];
  return p;
}
