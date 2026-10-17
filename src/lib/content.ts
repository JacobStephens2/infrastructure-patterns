import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import { gfmHeadingId, getHeadingList } from 'marked-gfm-heading-id';

export const repository =
  'https://github.com/JacobStephens2/infrastructure-patterns';
const readme = readFileSync('README.md', 'utf8');
export const companions = [
  {
    source: 'case-study/README.md',
    path: '/case-study/',
    label: 'The platform case study',
    description:
      'A twenty-year-old reservations platform, modernized while the business kept running.',
  },
  {
    source: 'threat-model/agent-sandbox.md',
    path: '/threat-model/',
    label: 'The agent threat model',
    description:
      'Assets, threats, controls, and the risks that remain when agents touch production systems.',
  },
  {
    source: 'checklist/operational-review.md',
    path: '/checklist/',
    label: 'The operational checklist',
    description:
      'The questions I ask before a system is ready to hold real money.',
  },
  {
    source: 'observability/README.md',
    path: '/observability/',
    label: 'The observability stack',
    description:
      'Sanitized Prometheus, Grafana, and Alertmanager configuration you can inspect and reuse.',
  },
];
const routes = new Map<string, string>([
  ['README.md', '/about/'],
  ['adr/', '/#library'],
  ['observability/app-service.png', '/assets/app-service.png'],
]);
for (const item of companions) {
  routes.set(item.source, item.path);
  routes.set(path.posix.dirname(item.source) + '/', item.path);
}
const files = readdirSync('adr')
  .filter((file) => file.endsWith('.md'))
  .sort();
for (const file of files)
  routes.set(`adr/${file}`, `/decisions/${file.slice(0, -3)}/`);

function resolveLink(href: string, source: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return href;
  const [file] = href.split(/[?#]/, 1);
  const suffix = href.slice(file.length);
  const target = path.posix.normalize(
    path.posix.join(path.posix.dirname(source), file),
  );
  if (!existsSync(target))
    throw new Error(`Broken repository link in ${source}: ${href}`);
  return (routes.get(target) ?? `${repository}/blob/main/${target}`) + suffix;
}

export function renderMarkdown(markdown: string, source: string) {
  const parser = new Marked(gfmHeadingId(), {
    walkTokens(token) {
      if (token.type === 'link' || token.type === 'image')
        token.href = resolveLink(token.href, source);
    },
  });
  const html = parser.parse(markdown, { async: false });
  const headings = getHeadingList().filter((heading) => heading.level === 2);
  return { html, headings };
}

const topics = [
  ...readme.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm),
].map((match) => ({
  name: match[1],
  records: [
    ...match[2].matchAll(/^\| \[(\d{4})\]\(([^)]+)\) \| (.+?) \| (.+?) \|$/gm),
  ].map((row) => ({
    id: row[1],
    source: row[2],
    summary: row[4],
  })),
}));

export const decisions = files.map((file) => {
  const source = `adr/${file}`;
  const markdown = readFileSync(source, 'utf8');
  const topic = topics.find((topic) =>
    topic.records.some((record) => record.source === source),
  );
  const record = topic?.records.find((record) => record.source === source);
  if (!topic || !record)
    throw new Error(`${source} needs a topic and summary in README.md`);
  const title = markdown.split('\n')[0].replace(/^# ADR \d+ - /, '');
  return {
    ...record,
    title,
    topic: topic.name,
    slug: file.slice(0, -3),
    path: `/decisions/${file.slice(0, -3)}/`,
    minutes: Math.max(1, Math.round(markdown.split(/\s+/).length / 220)),
    search: markdown.toLocaleLowerCase(),
    ...renderMarkdown(markdown.slice(markdown.indexOf('\n') + 1), source),
  };
});
export const topicNames = topics.map((topic) => topic.name);
const startHere = readme.split('## Start here\n')[1].split('\n## ')[0];
export const featured = [...startHere.matchAll(/^- \[(\d{4})\]/gm)].map(
  (match) => {
    const decision = decisions.find((decision) => decision.id === match[1]);
    if (!decision) throw new Error(`Featured ADR ${match[1]} is missing`);
    return decision;
  },
);
export function companionDocument(source: string) {
  const markdown = readFileSync(source, 'utf8');
  return {
    title: markdown.split('\n')[0].replace(/^# /, ''),
    ...renderMarkdown(markdown.slice(markdown.indexOf('\n') + 1), source),
  };
}
export function aboutDocument() {
  return renderMarkdown(
    readme.slice(readme.indexOf('\n') + 1).split('## Start here\n')[0],
    'README.md',
  );
}
