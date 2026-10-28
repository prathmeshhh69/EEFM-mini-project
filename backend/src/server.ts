import 'dotenv/config'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { GoogleGenAI } from '@google/genai'

const app = express()
const port = Number(process.env.PORT ?? 4000)
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', process.env.FRONTEND_ORIGIN].filter(Boolean))

const supportedStocks = {
  RELIANCE: { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2941.2, change: '+1.24%', positive: true },
  TCS: { symbol: 'TCS', name: 'Tata Consultancy Services', price: 3884.65, change: '+0.82%', positive: true },
  INFY: { symbol: 'INFY', name: 'Infosys', price: 1522.4, change: '-0.36%', positive: false },
  HDFCBANK: { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1674.1, change: '+0.58%', positive: true },
  ICICIBANK: { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 1208.75, change: '-0.14%', positive: false },
} as const

type StockSymbol = keyof typeof supportedStocks
type StockPayload = { symbol: string; name: string; price: number; change: string; positive: boolean }
type AnalysisResult = { verdict: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string; priceSummary: string; risk: string; watchFor: string[] }
type SentimentResult = { sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; summary: string; keyPhrases: string[]; marketImplication: string; disclaimer: string }
type MarketBrief = { overallAssessment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; trendSignal: 'UPWARD' | 'DOWNWARD' | 'SIDEWAYS' | 'INSUFFICIENT_DATA'; sentimentSignal: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'NOT_PROVIDED'; reasoning: string; riskFactors: string[]; learningInsight: string; nextThingsToObserve: string[] }
type MarketBriefPayload = { symbol: string; pricePoints: Array<{ timestamp: number; price: number }>; changePercent: string; trend: 'UPWARD' | 'DOWNWARD' | 'SIDEWAYS'; volatility: 'LOW' | 'MEDIUM' | 'HIGH'; headline?: string; sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' }

app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.has(origin)) callback(null, true); else callback(new Error('Origin not allowed')) } }))
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (_request, response) => response.json({ ok: true, model: modelName }))

app.post('/api/ai/sentiment', async (request: Request, response: Response) => {
  const text = typeof request.body?.text === 'string' ? request.body.text.trim() : ''
  if (!text || text.length > 2000) {
    response.status(400).json({ error: 'Enter a headline or excerpt between 1 and 2,000 characters.' })
    return
  }
  if (!process.env.GEMINI_API_KEY) {
    response.status(503).json({ error: 'The Gemini API is not configured on the backend. Add GEMINI_API_KEY to backend/.env.' })
    return
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await ai.models.generateContent({ model: modelName, contents: buildSentimentPrompt(text), config: { responseMimeType: 'application/json' } })
    const sentiment = parseSentimentResult(result.text?.trim() ?? '')
    if (!sentiment) {
      response.status(502).json({ error: 'Gemini returned an unexpected sentiment format. Please try again.' })
      return
    }
    response.json({ sentiment: JSON.stringify(sentiment), model: modelName })
  } catch (error) {
    console.error('Gemini sentiment request failed:', error instanceof Error ? error.message : 'unknown error')
    response.status(502).json({ error: 'Gemini could not analyze this text. Check the API key, quota, or network connection and try again.' })
  }
})

app.post('/api/ai/analyze', async (request: Request, response: Response) => {
  const { symbol, stock } = request.body as { symbol?: unknown; stock?: unknown }
  const selectedSymbol = typeof symbol === 'string' ? symbol.toUpperCase() : ''
  const knownStock = supportedStocks[selectedSymbol as StockSymbol]

  if (!knownStock || !isValidStockPayload(stock, selectedSymbol)) {
    response.status(400).json({ error: 'Select one supported stock and provide its valid simulated sample data.' })
    return
  }
  if (!process.env.GEMINI_API_KEY) {
    response.status(503).json({ error: 'The Gemini API is not configured on the backend. Add GEMINI_API_KEY to backend/.env.' })
    return
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await ai.models.generateContent({ model: modelName, contents: buildPrompt(knownStock), config: { responseMimeType: 'application/json' } })
    const text = result.text?.trim()
    if (!text) {
      response.status(502).json({ error: 'Gemini returned an empty analysis. Please try again.' })
      return
    }
    const analysis = parseAnalysisResult(text)
    if (!analysis) {
      response.status(502).json({ error: 'Gemini returned an analysis in an unexpected format. Please try again.' })
      return
    }
    response.json({ analysis: JSON.stringify(analysis), model: modelName, simulatedData: true })
  } catch (error) {
    console.error('Gemini analysis request failed:', error instanceof Error ? error.message : 'unknown error')
    response.status(502).json({ error: 'Gemini could not complete the analysis. Check the API key, model, quota, or network connection and try again.' })
  }
})

app.post('/api/ai/market-brief', async (request: Request, response: Response) => {
  const payload = request.body as Partial<MarketBriefPayload>
  if (!isValidMarketBriefPayload(payload)) {
    response.status(400).json({ error: 'Provide a supported stock, recent simulated price points, trend, volatility, and valid optional headline data.' })
    return
  }
  if (!process.env.GEMINI_API_KEY) {
    response.status(503).json({ error: 'The Gemini API is not configured on the backend. Add GEMINI_API_KEY to backend/.env.' })
    return
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await ai.models.generateContent({ model: modelName, contents: buildMarketBriefPrompt(payload), config: { responseMimeType: 'application/json' } })
    const brief = parseMarketBriefResult(result.text?.trim() ?? '')
    if (!brief) {
      response.status(502).json({ error: 'Gemini returned an unexpected market brief format. Please try again.' })
      return
    }
    response.json({ brief: JSON.stringify(brief), model: modelName, simulatedData: true })
  } catch (error) {
    console.error('Gemini market brief request failed:', error instanceof Error ? error.message : 'unknown error')
    response.status(502).json({ error: 'Gemini could not generate the market brief. Check the API key, quota, or network connection and try again.' })
  }
})

app.use((_request, response) => response.status(404).json({ error: 'Route not found.' }))
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: 'Request body must be valid JSON.' })
    return
  }
  response.status(500).json({ error: 'The backend could not process the request.' })
})

app.listen(port, () => console.log(`StockSense AI backend listening on http://localhost:${port}`))

function isValidStockPayload(value: unknown, expectedSymbol: string): value is StockPayload {
  if (!value || typeof value !== 'object') return false
  const stock = value as Partial<StockPayload>
  return stock.symbol === expectedSymbol && typeof stock.name === 'string' && stock.name.length > 0 && typeof stock.price === 'number' && Number.isFinite(stock.price) && stock.price >= 0 && typeof stock.change === 'string' && stock.change.length <= 20 && typeof stock.positive === 'boolean'
}

function isValidMarketBriefPayload(value: Partial<MarketBriefPayload>): value is MarketBriefPayload {
  const validTrend = value.trend === 'UPWARD' || value.trend === 'DOWNWARD' || value.trend === 'SIDEWAYS'
  const validVolatility = value.volatility === 'LOW' || value.volatility === 'MEDIUM' || value.volatility === 'HIGH'
  const validSentiment = value.sentiment === undefined || value.sentiment === 'POSITIVE' || value.sentiment === 'NEGATIVE' || value.sentiment === 'NEUTRAL'
  return typeof value.symbol === 'string' && Object.hasOwn(supportedStocks, value.symbol) &&
    Array.isArray(value.pricePoints) && value.pricePoints.length >= 2 && value.pricePoints.length <= 30 &&
    value.pricePoints.every((point) => point && Number.isFinite(point.timestamp) && Number.isFinite(point.price) && point.price > 0) &&
    typeof value.changePercent === 'string' && value.changePercent.length <= 20 && validTrend && validVolatility &&
    validSentiment && (value.headline === undefined || (typeof value.headline === 'string' && value.headline.length <= 2000))
}

function buildPrompt(stock: StockPayload) {
  return `You are StockSense AI, a beginner-friendly educational stock explainer. Analyze only the supplied simulated sample data below. Do not browse, infer undisclosed company facts, invent financial figures, news, or historical trends, predict future prices, or guarantee returns.

Stock data:
${JSON.stringify(stock, null, 2)}

Return only valid JSON with exactly these fields and no Markdown fences:
{
  "verdict": "BULLISH" | "NEUTRAL" | "BEARISH",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "reason": "one or two simple sentences based on the supplied price and percentage change",
  "priceSummary": "a concise summary of the supplied sample price and change",
  "risk": "one short relevant caution",
  "watchFor": ["one or two useful factors to investigate"]
}

Use a positive percentage change as a weak positive signal and a negative percentage change as a weak negative signal, never as conclusive evidence. Use NEUTRAL when evidence is too limited or conflicting. Confidence describes how much relevant evidence supports this explanation; it is not the probability of profit. Keep every field concise and beginner-friendly. Mention simulated/sample data where useful.`
}

function buildSentimentPrompt(text: string) {
  return `You are StockSense AI, a beginner-friendly sentiment classifier. Analyze only the supplied headline or excerpt. Do not invent a source, company facts, events, financial figures, or future price movement. Distinguish emotion or tone in the text from actual stock performance.

Supplied text:
${text}

Return only valid JSON with exactly these fields and no Markdown fences:
{
  "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "summary": "one or two simple sentences explaining the overall tone in the supplied text",
  "keyPhrases": ["up to three exact or near-exact phrases from the supplied text"],
  "marketImplication": "one cautious sentence about why the tone could matter to investors, without predicting a price movement",
  "disclaimer": "a short educational-use disclaimer"
}

If the text is vague, mixed, or insufficient, use NEUTRAL with LOW confidence. Confidence means confidence in classifying the text, not a probability of market movement. Keep every field concise.`
}

function buildMarketBriefPrompt(payload: MarketBriefPayload) {
  return `You are StockSense AI, a beginner-friendly educational market-pattern explainer. Use only the supplied data. Prices and trend/volatility are SIMULATED examples, not real-time NSE data. The headline is USER-PROVIDED text; never invent news, fundamentals, historical prices, or economic context. Do not predict prices, promise returns, or give probabilities. Use NEUTRAL when signals conflict or evidence is insufficient. Explain that this illustrates analytical concepts and does not reliably predict future prices.

Supplied market input:
${JSON.stringify(payload, null, 2)}

Return only valid JSON with exactly these fields:
{
  "overallAssessment": "BULLISH" | "NEUTRAL" | "BEARISH",
  "trendSignal": "UPWARD" | "DOWNWARD" | "SIDEWAYS" | "INSUFFICIENT_DATA",
  "sentimentSignal": "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "NOT_PROVIDED",
  "reasoning": "two or three short sentences connecting the supplied signals",
  "riskFactors": ["up to three relevant risks or limitations"],
  "learningInsight": "one beginner-friendly explanation of the observed pattern",
  "nextThingsToObserve": ["up to two indicators or data points to examine next"]
}

If headline is missing, sentimentSignal must be NOT_PROVIDED. Keep all text concise.`
}

function parseSentimentResult(text: string): SentimentResult | null {
  try {
    const normalized = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(normalized) as Partial<SentimentResult>
    const validSentiment = parsed.sentiment === 'POSITIVE' || parsed.sentiment === 'NEGATIVE' || parsed.sentiment === 'NEUTRAL'
    const validConfidence = parsed.confidence === 'LOW' || parsed.confidence === 'MEDIUM' || parsed.confidence === 'HIGH'
    if (!validSentiment || !validConfidence || typeof parsed.summary !== 'string' || typeof parsed.marketImplication !== 'string' || typeof parsed.disclaimer !== 'string' || !Array.isArray(parsed.keyPhrases) || parsed.keyPhrases.length > 3 || parsed.keyPhrases.some((phrase) => typeof phrase !== 'string')) return null
    return { sentiment: parsed.sentiment as SentimentResult['sentiment'], confidence: parsed.confidence as SentimentResult['confidence'], summary: parsed.summary, keyPhrases: parsed.keyPhrases as string[], marketImplication: parsed.marketImplication, disclaimer: parsed.disclaimer }
  } catch {
    return null
  }
}

function parseMarketBriefResult(text: string): MarketBrief | null {
  try {
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as Partial<MarketBrief>
    const validAssessment = parsed.overallAssessment === 'BULLISH' || parsed.overallAssessment === 'NEUTRAL' || parsed.overallAssessment === 'BEARISH'
    const validTrend = parsed.trendSignal === 'UPWARD' || parsed.trendSignal === 'DOWNWARD' || parsed.trendSignal === 'SIDEWAYS' || parsed.trendSignal === 'INSUFFICIENT_DATA'
    const validSentiment = parsed.sentimentSignal === 'POSITIVE' || parsed.sentimentSignal === 'NEGATIVE' || parsed.sentimentSignal === 'NEUTRAL' || parsed.sentimentSignal === 'NOT_PROVIDED'
    if (!validAssessment || !validTrend || !validSentiment || typeof parsed.reasoning !== 'string' || typeof parsed.learningInsight !== 'string' || !Array.isArray(parsed.riskFactors) || parsed.riskFactors.length > 3 || parsed.riskFactors.some((item) => typeof item !== 'string') || !Array.isArray(parsed.nextThingsToObserve) || parsed.nextThingsToObserve.length > 2 || parsed.nextThingsToObserve.some((item) => typeof item !== 'string')) return null
    return { overallAssessment: parsed.overallAssessment as MarketBrief['overallAssessment'], trendSignal: parsed.trendSignal as MarketBrief['trendSignal'], sentimentSignal: parsed.sentimentSignal as MarketBrief['sentimentSignal'], reasoning: parsed.reasoning, riskFactors: parsed.riskFactors, learningInsight: parsed.learningInsight, nextThingsToObserve: parsed.nextThingsToObserve }
  } catch {
    return null
  }
}

function parseAnalysisResult(text: string): AnalysisResult | null {
  try {
    const parsed = JSON.parse(text) as Partial<AnalysisResult>
    const validVerdict = parsed.verdict === 'BULLISH' || parsed.verdict === 'NEUTRAL' || parsed.verdict === 'BEARISH'
    const validConfidence = parsed.confidence === 'LOW' || parsed.confidence === 'MEDIUM' || parsed.confidence === 'HIGH'
    if (!validVerdict || !validConfidence || typeof parsed.reason !== 'string' || typeof parsed.priceSummary !== 'string' || typeof parsed.risk !== 'string' || !Array.isArray(parsed.watchFor) || parsed.watchFor.length < 1 || parsed.watchFor.length > 2 || parsed.watchFor.some((item) => typeof item !== 'string')) return null
    return { verdict: parsed.verdict as AnalysisResult['verdict'], confidence: parsed.confidence as AnalysisResult['confidence'], reason: parsed.reason, priceSummary: parsed.priceSummary, risk: parsed.risk, watchFor: parsed.watchFor }
  } catch {
    return null
  }
}
