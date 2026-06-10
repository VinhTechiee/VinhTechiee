import fs from "node:fs/promises";

const USERNAME = process.env.GITHUB_USER || "VinhTechiee";
const YEAR = process.env.CONTRIBUTION_YEAR || "2025";
const TOKEN = process.env.GITHUB_TOKEN;

const FROM = `${YEAR}-01-01T00:00:00Z`;
const TO = `${YEAR}-12-31T23:59:59Z`;

if (!TOKEN) {
  throw new Error("Missing GITHUB_TOKEN. Use secrets.SNAKE_TOKEN in workflow.");
}

const query = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            weekday
            contributionCount
            color
          }
        }
      }
    }
  }
}
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "custom-2025-contribution-snake",
  },
  body: JSON.stringify({
    query,
    variables: {
      login: USERNAME,
      from: FROM,
      to: TO,
    },
  }),
});

const json = await response.json();

if (!response.ok || json.errors) {
  console.error(JSON.stringify(json, null, 2));
  throw new Error("GitHub GraphQL request failed.");
}

const calendar =
  json.data.user.contributionsCollection.contributionCalendar;

const weeks = calendar.weeks;
const totalContributions = calendar.totalContributions;

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 30;
const TOP = 58;
const WIDTH = LEFT + weeks.length * STEP + 40;
const HEIGHT = TOP + 7 * STEP + 55;

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getDayColor(day, dark) {
  if (day.contributionCount === 0) {
    return dark ? "#161b22" : "#ebedf0";
  }

  return day.color || "#39d353";
}

function buildSvg(dark = false) {
  const bg = dark ? "#0d1117" : "#ffffff";
  const text = dark ? "#c9d1d9" : "#24292f";
  const muted = dark ? "#8b949e" : "#57606a";
  const stroke = dark ? "#30363d" : "#d0d7de";
  const snake = dark ? "#39d353" : "#2da44e";

  const dayRects = [];
  const snakePoints = [];
  const monthLabels = new Map();

  weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day) => {
      const x = LEFT + weekIndex * STEP;
      const y = TOP + day.weekday * STEP;

      const date = new Date(`${day.date}T00:00:00Z`);
      const month = date.getUTCMonth();
      const dayOfMonth = date.getUTCDate();

      if (dayOfMonth <= 7 && !monthLabels.has(month)) {
        monthLabels.set(month, {
          label: months[month],
          x,
        });
      }

      dayRects.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${CELL}"
          height="${CELL}"
          rx="2"
          fill="${getDayColor(day, dark)}"
          stroke="${stroke}"
          stroke-width="0.4"
        >
          <title>${escapeXml(day.date)}: ${day.contributionCount} contributions</title>
        </rect>
      `);

      if (day.contributionCount > 0) {
        snakePoints.push({
          x: x + CELL / 2,
          y: y + CELL / 2,
          date: day.date,
        });
      }
    });
  });

  snakePoints.sort((a, b) => a.date.localeCompare(b.date));

  const pathD =
    snakePoints.length > 0
      ? snakePoints
          .map((p, index) =>
            index === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
          )
          .join(" ")
      : `M ${LEFT} ${TOP}`;

  const pathLength = Math.max(300, snakePoints.length * STEP);

  const monthText = [...monthLabels.values()]
    .map(
      (m) => `
        <text x="${m.x}" y="${TOP - 10}" fill="${muted}" font-size="10">
          ${m.label}
        </text>
      `
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${WIDTH}"
  height="${HEIGHT}"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
  role="img"
  aria-label="${USERNAME} ${YEAR} GitHub contribution snake"
>
  <rect width="100%" height="100%" fill="${bg}" rx="10" />

  <text x="${LEFT}" y="28" fill="${text}" font-size="16" font-weight="600">
    ${escapeXml(USERNAME)} contribution snake — ${YEAR}
  </text>

  <text x="${LEFT}" y="45" fill="${muted}" font-size="11">
    ${totalContributions} contributions in ${YEAR}
  </text>

  ${monthText}

  <g>
    ${dayRects.join("\n")}
  </g>

  <path
    id="snake-path"
    d="${pathD}"
    fill="none"
    stroke="${snake}"
    stroke-width="13"
    stroke-linecap="round"
    stroke-linejoin="round"
    opacity="0.35"
    pathLength="${pathLength}"
    stroke-dasharray="80 ${pathLength}"
  >
    <animate
      attributeName="stroke-dashoffset"
      values="${pathLength};0"
      dur="18s"
      repeatCount="indefinite"
    />
  </path>

  <circle r="8" fill="${snake}">
    <animateMotion dur="18s" repeatCount="indefinite" rotate="auto">
      <mpath xlink:href="#snake-path" />
    </animateMotion>
  </circle>

  <circle r="3" fill="${bg}">
    <animateMotion dur="18s" repeatCount="indefinite" rotate="auto">
      <mpath xlink:href="#snake-path" />
    </animateMotion>
  </circle>
</svg>`;
}

await fs.mkdir("dist", { recursive: true });

await fs.writeFile(
  "dist/github-contribution-grid-snake.svg",
  buildSvg(false),
  "utf8"
);

await fs.writeFile(
  "dist/github-contribution-grid-snake-dark.svg",
  buildSvg(true),
  "utf8"
);

console.log(`Generated custom ${YEAR} snake for ${USERNAME}`);
console.log(`Total contributions: ${totalContributions}`);
