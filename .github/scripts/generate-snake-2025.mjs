import fs from "node:fs/promises";

const USERNAME = process.env.GITHUB_USER || "VinhTechiee";
const YEAR = process.env.CONTRIBUTION_YEAR || "2025";
const TOKEN = process.env.GITHUB_TOKEN;

const FROM = `${YEAR}-01-01T00:00:00Z`;
const TO = `${YEAR}-12-31T23:59:59Z`;

if (!TOKEN) {
  throw new Error("Missing GITHUB_TOKEN");
}

const query = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
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
    "User-Agent": "custom-2025-snake",
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

const weeks =
  json.data.user.contributionsCollection.contributionCalendar.weeks;

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 18;
const TOP = 18;
const WIDTH = LEFT + weeks.length * STEP + 18;
const HEIGHT = TOP + 7 * STEP + 18;

function emptyColor(dark) {
  return dark ? "#161b22" : "#ebedf0";
}

function borderColor(dark) {
  return dark ? "#0d1117" : "#ffffff";
}

function buildSmoothPath(points) {
  if (points.length === 0) return `M ${LEFT} ${TOP}`;
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }

  const last2 = points[points.length - 2];
  const last = points[points.length - 1];
  d += ` Q ${last2.x} ${last2.y} ${last.x} ${last.y}`;

  return d;
}

function buildSvg(dark = false) {
  const bg = dark ? "#0d1117" : "#ffffff";

  const snakeMain = "#a855f7";
  const snakeGlow = "#c084fc";
  const snakeHighlight = "#d8b4fe";
  const tongueColor = "#fb7185";

  const rects = [];
  const activePoints = [];

  weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day) => {
      const x = LEFT + weekIndex * STEP;
      const y = TOP + day.weekday * STEP;

      const fill =
        day.contributionCount === 0
          ? emptyColor(dark)
          : day.color || "#39d353";

      rects.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${CELL}"
          height="${CELL}"
          rx="2"
          fill="${fill}"
          stroke="${borderColor(dark)}"
          stroke-width="0.6"
        >
          <title>${day.date}: ${day.contributionCount} contributions</title>
        </rect>
      `);

      if (day.contributionCount > 0) {
        activePoints.push({
          x: x + CELL / 2,
          y: y + CELL / 2,
          date: day.date,
        });
      }
    });
  });

  activePoints.sort((a, b) => a.date.localeCompare(b.date));

  const pathD = buildSmoothPath(activePoints);
  const pathLength = Math.max(1000, activePoints.length * 22);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${WIDTH}"
  height="${HEIGHT}"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
>
  <rect width="100%" height="100%" fill="${bg}" rx="10" />

  <g>
    ${rects.join("\n")}
  </g>

  <!-- soft trail -->
  <path
    d="${pathD}"
    fill="none"
    stroke="${snakeGlow}"
    stroke-width="8"
    stroke-linecap="round"
    stroke-linejoin="round"
    opacity="0.14"
  />

  <!-- animated body -->
  <path
    id="snake-path"
    d="${pathD}"
    fill="none"
    stroke="${snakeMain}"
    stroke-width="8"
    stroke-linecap="round"
    stroke-linejoin="round"
    pathLength="${pathLength}"
    stroke-dasharray="70 ${pathLength}"
    filter="url(#glow)"
  >
    <animate
      attributeName="stroke-dashoffset"
      from="${pathLength}"
      to="0"
      dur="11s"
      repeatCount="indefinite"
    />
  </path>

  <!-- snake head -->
  <g>
    <g id="snake-head">
      <ellipse cx="0" cy="0" rx="8.2" ry="6.8" fill="${snakeMain}" />
      <ellipse cx="-1" cy="-1.2" rx="6.3" ry="4.9" fill="${snakeHighlight}" opacity="0.35" />

      <!-- eyes -->
      <circle cx="-2.4" cy="-1.7" r="1.15" fill="white" />
      <circle cx="2.4" cy="-1.7" r="1.15" fill="white" />
      <circle cx="-2.4" cy="-1.7" r="0.5" fill="#111827" />
      <circle cx="2.4" cy="-1.7" r="0.5" fill="#111827" />

      <!-- tongue -->
      <path
        d="M 0 2.5 L 0 6.4 M 0 6.4 L -1.5 8.2 M 0 6.4 L 1.5 8.2"
        stroke="${tongueColor}"
        stroke-width="1.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />

      <!-- little nose -->
      <circle cx="-0.8" cy="0.9" r="0.35" fill="#6b21a8" />
      <circle cx="0.8" cy="0.9" r="0.35" fill="#6b21a8" />
    </g>

    <animateMotion dur="11s" repeatCount="indefinite" rotate="auto">
      <mpath xlink:href="#snake-path" />
    </animateMotion>
  </g>

  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="1.4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
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

console.log(`Generated custom contribution snake for ${USERNAME} (${YEAR})`);
