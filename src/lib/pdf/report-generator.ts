/**
 * PDF Report Generator
 * Uses pdf-lib for Cloudflare Workers-compatible PDF generation
 *
 * ASSUMPTIONS:
 * - pdf-lib package is installed: npm install pdf-lib
 * - Reports are generated on-demand or via scheduled jobs
 * - PDF styling is minimal but professional
 */

import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';

export interface ReportData {
  workspace_name: string;
  board_name?: string;
  generated_at: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    total_feedback: number;
    total_votes: number;
    total_comments: number;
    avg_sentiment: number;
    resolution_rate: number;
  };
  status_breakdown: Record<string, number>;
  top_feedback: Array<{
    id: number;
    title: string;
    votes: number;
    status: string;
    sentiment?: number;
  }>;
  themes?: Array<{
    name: string;
    count: number;
    trend: 'rising' | 'stable' | 'falling';
  }>;
  trends?: {
    feedback_change: number;
    vote_change: number;
    sentiment_change: number;
  };
}

export interface ReportOptions {
  include_charts?: boolean;
  include_themes?: boolean;
  include_top_feedback?: boolean;
  max_feedback_items?: number;
  branding?: {
    logo_url?: string;
    primary_color?: string;
    company_name?: string;
  };
}

/**
 * Generate a PDF report from feedback data
 */
export async function generatePDFReport(
  data: ReportData,
  options: ReportOptions = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Colors
  const primaryColor = rgb(0.2, 0.4, 0.8); // Blue
  const textColor = rgb(0.1, 0.1, 0.1);
  const secondaryColor = rgb(0.5, 0.5, 0.5);
  const successColor = rgb(0.2, 0.7, 0.3);
  const warningColor = rgb(0.9, 0.6, 0.1);
  const dangerColor = rgb(0.8, 0.2, 0.2);

  // Page setup
  let page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // Helper functions
  const drawText = (text: string, x: number, yPos: number, size: number, font = helvetica, color = textColor) => {
    page.drawText(text, { x, y: yPos, size, font, color });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 1) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color: secondaryColor,
    });
  };

  const addNewPage = () => {
    page = pdfDoc.addPage(PageSizes.A4);
    y = height - margin;
  };

  const checkPageBreak = (needed: number) => {
    if (y - needed < margin) {
      addNewPage();
    }
  };

  // === HEADER ===
  drawText('Feedback Report', margin, y, 24, helveticaBold, primaryColor);
  y -= 30;

  const subtitle = data.board_name
    ? `${data.workspace_name} - ${data.board_name}`
    : data.workspace_name;
  drawText(subtitle, margin, y, 14, helvetica, secondaryColor);
  y -= 20;

  drawText(`Period: ${data.period.start} to ${data.period.end}`, margin, y, 10, helvetica, secondaryColor);
  y -= 10;
  drawText(`Generated: ${data.generated_at}`, margin, y, 10, helvetica, secondaryColor);
  y -= 30;

  drawLine(margin, y, width - margin, y, 2);
  y -= 30;

  // === EXECUTIVE SUMMARY ===
  drawText('Executive Summary', margin, y, 16, helveticaBold, primaryColor);
  y -= 25;

  // Summary metrics in a grid
  const metrics = [
    { label: 'Total Feedback', value: data.summary.total_feedback.toString() },
    { label: 'Total Votes', value: data.summary.total_votes.toString() },
    { label: 'Comments', value: data.summary.total_comments.toString() },
    { label: 'Avg Sentiment', value: `${(data.summary.avg_sentiment * 100).toFixed(0)}%` },
    { label: 'Resolution Rate', value: `${(data.summary.resolution_rate * 100).toFixed(0)}%` },
  ];

  const colWidth = (width - 2 * margin) / 3;
  let col = 0;
  for (const metric of metrics) {
    const x = margin + (col % 3) * colWidth;

    // Draw metric box
    page.drawRectangle({
      x,
      y: y - 40,
      width: colWidth - 10,
      height: 50,
      borderColor: secondaryColor,
      borderWidth: 1,
    });

    drawText(metric.value, x + 10, y - 20, 18, helveticaBold, primaryColor);
    drawText(metric.label, x + 10, y - 35, 10, helvetica, secondaryColor);

    col++;
    if (col % 3 === 0) {
      y -= 60;
    }
  }

  if (col % 3 !== 0) {
    y -= 60;
  }
  y -= 20;

  // === TRENDS ===
  if (data.trends) {
    checkPageBreak(100);
    drawText('Trends vs Previous Period', margin, y, 16, helveticaBold, primaryColor);
    y -= 25;

    const formatChange = (change: number) => {
      const prefix = change >= 0 ? '+' : '';
      return `${prefix}${(change * 100).toFixed(1)}%`;
    };

    const getChangeColor = (change: number, positive = true) => {
      if (positive) {
        return change > 0 ? successColor : change < 0 ? dangerColor : secondaryColor;
      }
      return change < 0 ? successColor : change > 0 ? dangerColor : secondaryColor;
    };

    const trends = [
      { label: 'Feedback Volume', change: data.trends.feedback_change },
      { label: 'Vote Activity', change: data.trends.vote_change },
      { label: 'Sentiment', change: data.trends.sentiment_change },
    ];

    for (const trend of trends) {
      drawText(`${trend.label}: `, margin, y, 11, helvetica, textColor);
      drawText(formatChange(trend.change), margin + 100, y, 11, helveticaBold, getChangeColor(trend.change));
      y -= 18;
    }
    y -= 20;
  }

  // === STATUS BREAKDOWN ===
  checkPageBreak(150);
  drawText('Status Breakdown', margin, y, 16, helveticaBold, primaryColor);
  y -= 25;

  const statusColors: Record<string, typeof primaryColor> = {
    open: rgb(0.3, 0.5, 0.9),
    under_review: rgb(0.9, 0.7, 0.2),
    planned: rgb(0.5, 0.3, 0.8),
    in_progress: rgb(0.2, 0.7, 0.9),
    done: successColor,
    declined: secondaryColor,
  };

  const totalItems = Object.values(data.status_breakdown).reduce((a, b) => a + b, 0);

  for (const [status, count] of Object.entries(data.status_breakdown)) {
    const percentage = totalItems > 0 ? (count / totalItems) * 100 : 0;
    const barWidth = ((width - 2 * margin - 150) * percentage) / 100;

    drawText(status.replace('_', ' ').toUpperCase(), margin, y, 10, helvetica, textColor);

    // Draw bar
    page.drawRectangle({
      x: margin + 100,
      y: y - 3,
      width: barWidth,
      height: 12,
      color: statusColors[status] || secondaryColor,
    });

    drawText(`${count} (${percentage.toFixed(0)}%)`, margin + 110 + barWidth, y, 10, helvetica, secondaryColor);
    y -= 20;
  }
  y -= 20;

  // === THEMES ===
  if (options.include_themes !== false && data.themes?.length) {
    checkPageBreak(30 + data.themes.length * 20);
    drawText('Top Themes', margin, y, 16, helveticaBold, primaryColor);
    y -= 25;

    for (const theme of data.themes.slice(0, 10)) {
      const trendIcon = theme.trend === 'rising' ? '↑' : theme.trend === 'falling' ? '↓' : '→';
      const trendColor = theme.trend === 'rising' ? successColor : theme.trend === 'falling' ? dangerColor : secondaryColor;

      drawText(`• ${theme.name}`, margin, y, 11, helvetica, textColor);
      drawText(`${theme.count} items`, margin + 250, y, 11, helvetica, secondaryColor);
      drawText(trendIcon, margin + 350, y, 11, helveticaBold, trendColor);
      y -= 18;
    }
    y -= 20;
  }

  // === TOP FEEDBACK ===
  if (options.include_top_feedback !== false && data.top_feedback?.length) {
    checkPageBreak(50);
    addNewPage();

    drawText('Top Feedback Items', margin, y, 16, helveticaBold, primaryColor);
    y -= 25;

    const maxItems = options.max_feedback_items || 20;

    // Table header
    drawText('#', margin, y, 10, helveticaBold, secondaryColor);
    drawText('Title', margin + 30, y, 10, helveticaBold, secondaryColor);
    drawText('Votes', margin + 350, y, 10, helveticaBold, secondaryColor);
    drawText('Status', margin + 400, y, 10, helveticaBold, secondaryColor);
    y -= 5;
    drawLine(margin, y, width - margin, y);
    y -= 15;

    for (let i = 0; i < Math.min(data.top_feedback.length, maxItems); i++) {
      checkPageBreak(25);
      const item = data.top_feedback[i];

      // Truncate title if too long
      let title = item.title;
      if (title.length > 45) {
        title = title.substring(0, 42) + '...';
      }

      drawText((i + 1).toString(), margin, y, 10, helvetica, secondaryColor);
      drawText(title, margin + 30, y, 10, helvetica, textColor);
      drawText(item.votes.toString(), margin + 350, y, 10, helveticaBold, primaryColor);
      drawText(item.status.replace('_', ' '), margin + 400, y, 9, helvetica, statusColors[item.status] || secondaryColor);

      y -= 18;
    }
  }

  // === FOOTER ===
  const footerText = options.branding?.company_name
    ? `Generated by ${options.branding.company_name} powered by Collective Vision`
    : 'Generated by Collective Vision';

  // Add footer to all pages
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawText(footerText, {
      x: margin,
      y: 30,
      size: 8,
      font: helvetica,
      color: secondaryColor,
    });
    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: width - margin - 50,
      y: 30,
      size: 8,
      font: helvetica,
      color: secondaryColor,
    });
  }

  return await pdfDoc.save();
}

/**
 * Generate a simple one-page summary PDF
 */
export async function generateSummaryPDF(
  workspaceName: string,
  stats: {
    total_feedback: number;
    total_votes: number;
    open: number;
    done: number;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();

  const primaryColor = rgb(0.2, 0.4, 0.8);
  const textColor = rgb(0.1, 0.1, 0.1);

  // Title
  page.drawText('Feedback Summary', {
    x: 50,
    y: height - 50,
    size: 24,
    font: helveticaBold,
    color: primaryColor,
  });

  page.drawText(workspaceName, {
    x: 50,
    y: height - 80,
    size: 14,
    font: helvetica,
    color: textColor,
  });

  // Stats
  const statsY = height - 150;
  const statsData = [
    { label: 'Total Feedback', value: stats.total_feedback },
    { label: 'Total Votes', value: stats.total_votes },
    { label: 'Open Items', value: stats.open },
    { label: 'Completed', value: stats.done },
  ];

  statsData.forEach((stat, i) => {
    page.drawText(stat.value.toString(), {
      x: 50,
      y: statsY - i * 50,
      size: 32,
      font: helveticaBold,
      color: primaryColor,
    });
    page.drawText(stat.label, {
      x: 50,
      y: statsY - i * 50 - 20,
      size: 12,
      font: helvetica,
      color: textColor,
    });
  });

  return await pdfDoc.save();
}
