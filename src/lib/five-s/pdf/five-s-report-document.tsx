import { Document, Page, View, Text, Svg, Polygon, Line, Circle, StyleSheet } from "@react-pdf/renderer";
import type { FiveSReportData, FiveSReportMeta, FiveSTestSection, FiveSTestRow, FiveSQuestionSection } from "@/lib/five-s/report-data";
import { FIVE_S_RADAR_AXES } from "@/components/profile/five-s-radar-section";

// Hex equivalents of the app's oklch design tokens (globals.css) — react-pdf
// doesn't support oklch()/CSS variables, so the light-theme palette is
// resolved to literal hex once here. Keep in sync with src/app/globals.css
// if the palette changes.
const COLORS = {
  primary: "#2464e9",
  primaryForeground: "#fafcff",
  primarySoft: "#e9f0fd", // ~ bg-primary/10 over white
  foreground: "#151b24",
  mutedForeground: "#5e646d",
  muted: "#edf0f6",
  mutedSoft: "#f4f6fa", // ~ bg-muted/60 over white
  border: "#dce0e6",
  borderSoft: "#eef0f3", // ~ border-border/50 over white
  card: "#ffffff",
  chart1: "#2a78d6",
  chart2: "#eb6834",
  chart3: "#1baf7a", // radar series color — matches RadarChart's default
  chart4: "#eda100",
};

const CATEGORY_ACCENTS = [COLORS.chart1, COLORS.chart2, COLORS.chart3, COLORS.chart4, COLORS.primary];

const ANSWER_LABEL: Record<string, string> = {
  rarely: "Rarely",
  sometimes: "Sometimes",
  frequently: "Frequently",
  always: "Always",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 74,
    paddingBottom: 52,
    paddingHorizontal: 40,
    fontSize: 10,
    color: COLORS.foreground,
    fontFamily: "Helvetica",
  },
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  headerBrand: { fontSize: 12, fontFamily: "Helvetica-Bold", color: COLORS.primary },
  headerTitle: { fontSize: 9, color: COLORS.mutedForeground },
  fixedFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 34,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: { fontSize: 8, color: COLORS.mutedForeground },
  hero: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 22, marginBottom: 22 },
  heroName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: COLORS.primaryForeground },
  heroMeta: { fontSize: 10, color: COLORS.primaryForeground, opacity: 0.85, marginTop: 5 },
  heroBadgeRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primaryForeground,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  radarRow: { flexDirection: "row", gap: 16, marginBottom: 22 },
  radarCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 16,
    alignItems: "center",
  },
  radarCardTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", alignSelf: "flex-start", marginBottom: 6 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 16,
    marginBottom: 14,
  },
  categoryHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  categoryAccent: { width: 4, height: 14, borderRadius: 2 },
  categoryLabel: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  ratingBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  groupLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: COLORS.mutedForeground,
    marginBottom: 6,
  },
  groupBlock: { marginBottom: 12 },
  testGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  testCell: { width: "48%" },
  testName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.mutedSoft,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minHeight: 22,
  },
  pillValue: { fontSize: 9.5 },
  pillValueMuted: { fontSize: 9.5, color: COLORS.mutedForeground },
  pillMeta: { fontSize: 7.5, color: COLORS.mutedForeground },
  subText: { fontSize: 8, color: COLORS.mutedForeground, marginTop: 3 },
  remarksBox: { backgroundColor: COLORS.mutedSoft, borderRadius: 8, padding: 10, marginTop: 8 },
  remarksLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: COLORS.mutedForeground },
  remarksText: { fontSize: 9.5, marginTop: 2 },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.mutedSoft,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 6,
    gap: 10,
  },
  questionText: { fontSize: 9.5, flex: 1 },
  answerBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  answerMuted: { fontSize: 8, color: COLORS.mutedForeground },
});

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Same polygon/axis geometry as the on-screen RadarChart
// (src/components/charts/radar-chart.tsx), reimplemented against react-pdf's
// Svg primitives (react-dom's <svg> can't be reused inside a PDF renderer)
// so the two visuals stay identical.
const RADAR_SIZE = 210;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 50;
const RADAR_LABEL_RADIUS = RADAR_RADIUS + 24;
const RADAR_GRID_LEVELS = [1, 2, 3, 4, 5];
const RADAR_MAX = 5;

function axisPoint(index: number, count: number, radius: number) {
  const angle = ((360 / count) * index - 90) * (Math.PI / 180);
  return { x: RADAR_CENTER + radius * Math.cos(angle), y: RADAR_CENTER + radius * Math.sin(angle) };
}

function RadarSvg({ scores }: { scores: Record<string, number> }) {
  const axes = FIVE_S_RADAR_AXES;
  const radiusForValue = (v: number) => (Math.max(0, v) / RADAR_MAX) * RADAR_RADIUS;
  const values = axes.map((a) => scores[a.key] ?? 0);

  return (
    <Svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}>
      {RADAR_GRID_LEVELS.map((level) => (
        <Polygon
          key={level}
          points={axes.map((_, i) => {
            const { x, y } = axisPoint(i, axes.length, (level / RADAR_MAX) * RADAR_RADIUS);
            return `${x},${y}`;
          }).join(" ")}
          fill="none"
          stroke={COLORS.border}
          strokeWidth={1}
        />
      ))}

      {axes.map((axis, i) => {
        const { x, y } = axisPoint(i, axes.length, RADAR_RADIUS);
        return <Line key={axis.key} x1={RADAR_CENTER} y1={RADAR_CENTER} x2={x} y2={y} stroke={COLORS.border} strokeWidth={1} />;
      })}

      <Polygon
        points={values.map((v, i) => {
          const { x, y } = axisPoint(i, values.length, radiusForValue(v));
          return `${x},${y}`;
        }).join(" ")}
        fill={COLORS.chart3}
        fillOpacity={0.22}
        stroke={COLORS.chart3}
        strokeWidth={2}
      />

      {values.map((v, i) => {
        const { x, y } = axisPoint(i, values.length, radiusForValue(v));
        return <Circle key={i} cx={x} cy={y} r={2.6} fill={COLORS.chart3} />;
      })}

      {axes.map((axis, i) => {
        const { x, y } = axisPoint(i, axes.length, RADAR_LABEL_RADIUS);
        const textAnchor = Math.abs(x - RADAR_CENTER) < 4 ? "middle" : x > RADAR_CENTER ? "start" : "end";
        return (
          <Text key={axis.key} x={x} y={y} style={{ fontSize: 7.5 }} fill={COLORS.mutedForeground} textAnchor={textAnchor}>
            {axis.label}
          </Text>
        );
      })}
    </Svg>
  );
}

function formatResultValue(test: FiveSTestRow) {
  if (!test.result) return "Not recorded yet";
  if (test.unit === "level") return `Level ${test.result.level} / Shuttle ${test.result.shuttle}`;
  return `${test.result.score} ${test.unit}`.trim();
}

function TestSectionCard({ section, accent }: { section: FiveSTestSection; accent: string }) {
  return (
    <View style={styles.card} wrap>
      <View style={styles.categoryHeading} minPresenceAhead={40}>
        <View style={[styles.categoryAccent, { backgroundColor: accent }]} />
        <Text style={styles.categoryLabel}>{section.categoryLabel}</Text>
        {section.rating != null && <Text style={styles.ratingBadge}>{section.rating} / 5</Text>}
      </View>

      {section.groups.map((group, i) => (
        <View key={group.label || i} style={styles.groupBlock}>
          {group.label ? <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text> : null}
          <View style={styles.testGrid}>
            {group.tests.map((test) => (
              <View key={test.id} style={styles.testCell} wrap={false}>
                <Text style={styles.testName}>{test.name}</Text>
                <View style={styles.pillRow}>
                  <Text style={test.result ? styles.pillValue : styles.pillValueMuted}>{formatResultValue(test)}</Text>
                  {test.result && <Text style={styles.pillMeta}>{formatDate(test.result.recorded_at)}</Text>}
                </View>
                {test.result?.vo2_max != null && <Text style={styles.subText}>VO2 Max: {test.result.vo2_max}</Text>}
                {test.result?.remarks && <Text style={styles.subText}>Remarks: {test.result.remarks}</Text>}
              </View>
            ))}
          </View>
          {group.remarks && (
            <View style={styles.remarksBox}>
              <Text style={styles.remarksLabel}>REMARKS</Text>
              <Text style={styles.remarksText}>{group.remarks}</Text>
            </View>
          )}
        </View>
      ))}

      {section.overallRemarks && (
        <View style={styles.remarksBox}>
          <Text style={styles.remarksLabel}>OVERALL REMARKS</Text>
          <Text style={styles.remarksText}>{section.overallRemarks}</Text>
        </View>
      )}
    </View>
  );
}

function QuestionSectionCard({ section }: { section: FiveSQuestionSection }) {
  return (
    <View style={styles.card} wrap>
      <View style={styles.categoryHeading} minPresenceAhead={40}>
        <Text style={styles.categoryLabel}>{section.categoryLabel}</Text>
        {section.rating != null && <Text style={styles.ratingBadge}>{section.rating} / 5</Text>}
      </View>
      {section.groups.map((group) => (
        <View key={group.label} style={styles.groupBlock}>
          <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
          {group.questions.map((q) => (
            <View key={q.id} style={styles.questionRow} wrap={false}>
              <Text style={styles.questionText}>{q.question}</Text>
              {q.answer ? (
                <Text style={styles.answerBadge}>{ANSWER_LABEL[q.answer] ?? q.answer}</Text>
              ) : (
                <Text style={styles.answerMuted}>Not recorded</Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function FiveSReportDocument({ meta, report }: { meta: NonNullable<FiveSReportMeta>; report: FiveSReportData }) {
  const generatedAt = new Date();
  const heroMetaLine = [meta.centreName, meta.batchName, meta.age != null ? `Age ${meta.age}` : null]
    .filter(Boolean)
    .join("   ·   ");

  return (
    <Document title={`${meta.playerName} - 5S Assessment Report`} author="Impetus" creator="Impetus">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.fixedHeader} fixed>
          <Text style={styles.headerBrand}>IMPETUS</Text>
          <Text style={styles.headerTitle}>5S Player Assessment Report</Text>
        </View>
        <View style={styles.fixedFooter} fixed>
          <Text style={styles.footerText}>Generated {formatDate(generatedAt)}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroName}>{meta.playerName}</Text>
          {heroMetaLine ? <Text style={styles.heroMeta}>{heroMetaLine}</Text> : null}
          <View style={styles.heroBadgeRow}>
            <Text style={styles.heroBadge}>5S SKILL ASSESSMENT</Text>
            {meta.publishedAt && <Text style={styles.heroBadge}>PUBLISHED {formatDate(meta.publishedAt).toUpperCase()}</Text>}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.radarRow}>
          <View style={styles.radarCard}>
            <Text style={styles.radarCardTitle}>Current Overview</Text>
            <RadarSvg scores={report.radar.current} />
          </View>
          {report.radar.hasPrevious && (
            <View style={styles.radarCard}>
              <Text style={styles.radarCardTitle}>Previous Overview</Text>
              <RadarSvg scores={report.radar.previous} />
            </View>
          )}
        </View>

        {report.testSections.length > 0 && <Text style={styles.sectionTitle}>Test Results</Text>}
        {report.testSections.map((section, i) => (
          <TestSectionCard key={section.category} section={section} accent={CATEGORY_ACCENTS[i % CATEGORY_ACCENTS.length]} />
        ))}

        {report.questionSections.length > 0 && (
          <Text style={styles.sectionTitle} break={report.testSections.length > 0}>
            Assessment Questions
          </Text>
        )}
        {report.questionSections.map((section) => (
          <QuestionSectionCard key={section.category} section={section} />
        ))}
      </Page>
    </Document>
  );
}
