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
    "User-Agent": "custom-snake-2025",
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

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 20;
const TOP = 25;
const WIDTH = LEFT + weeks.length * STEP + 20;
const HEIGHT = TOP + 7 * STEP + 20;

function emptyColor(dark) {
  return dark ? "#161b22" : "#ebedf0";
}

function strokeColor(dark) {
  return dark ? "#0d1117" : "#ffffff";
}

function buildSvg(dark = false) {
  const bg = dark ? "#0d1117" : "#ffffff";
  const snake = "#a855f7"; // tím
  const snakeGlow = "#c084fc";

  const rects = [];
  const snakePoints = [];

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
          stroke="${strokeColor(dark)}"
          stroke-width="0.6"
        >
          <title>${day.date}: ${day.contributionCount} contributions</title>
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
          .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
          .join(" ")
      : `M ${LEFT} ${TOP}`;

  const pathLength = Math.max(600, snakePoints.length * 18);

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

  <!-- snake trail -->
  <path
    id="snake-path"
    d="${pathD}"
    fill="none"
    stroke="${snakeGlow}"
    stroke-width="7"
    stroke-linecap="round"
    stroke-linejoin="round"
    opacity="0.25"
  />

  <!-- moving snake body -->
  <path
    d="${pathD}"
    fill="none"
    stroke="${snake}"
    stroke-width="7"
    stroke-linecap="round"
    stroke-linejoin="round"
    pathLength="${pathLength}"
    stroke-dasharray="45 ${pathLength}"
  >
    <animate
      attributeName="stroke-dashoffset"
      from="${pathLength}"
      to="0"
      dur="10s"
      repeatCount="indefinite"
    />
  </path>

  <!-- snake head -->
  <g>
    <circle r="7" fill="${snake}">
      <animateMotion dur="10s" repeatCount="indefinite" rotate="auto">
        <mpath xlink:href="#snake-path" />
      </animateMotion>
    </circle>

    <circle r="2" fill="white" cx="-2" cy="-1">
      <animateMotion dur="10s" repeatCount="indefinite" rotate="auto">
        <mpath xlink:href="#snake-path" />
      </animateMotion>
    </circle>

    <circle r="2" fill="white" cx="2" cy="-1">
      <animateMotion dur="10s" repeatCount="indefinite" rotate="auto">
        <mpath xlink:href="#snake-path" />
      </animateMotion>
    </circle>
  </g>
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

console.log(`Generated ${YEAR} snake for ${USERNAME}`);
