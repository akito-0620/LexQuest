// AI conversation logic.
// Default: scripted, scenario-aware replies that stay short and beginner-friendly.
// Optional: if ANTHROPIC_API_KEY is set, route turns through Claude.

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ScriptedScenario {
  slug: string;
  systemPrompt: string;
  opening: string;
  /** Each entry: candidate replies for that turn index (0 = first assistant reply AFTER the opening). */
  turns: string[][];
  closing: string;
}

const SCENARIOS: Record<string, ScriptedScenario> = {
  "first-meeting": {
    slug: "first-meeting",
    systemPrompt:
      "You are a friendly native English speaker meeting the user for the first time at a casual gathering. Keep replies to ONE short sentence (max ~12 words) in easy English. Ask ONE question per turn. Do not correct the user's grammar.",
    opening: "Hi! Nice to meet you. I'm Alex. What's your name?",
    turns: [
      [
        "Nice to meet you! Where are you from?",
        "Great name! Where do you live?",
      ],
      [
        "Oh cool! What do you like to do in your free time?",
        "Interesting! What kind of things do you enjoy?",
      ],
      [
        "That sounds fun! How long have you been into that?",
        "Nice! Do you do that often?",
      ],
      [
        "Oh, really? What else do you like?",
        "I see. What about on the weekend?",
      ],
      [
        "That's great. Do you have any plans this week?",
        "Cool. Anything you're looking forward to?",
      ],
      [
        "Sounds good. Well, it was really nice talking with you!",
        "Awesome. I'd love to chat again sometime!",
      ],
    ],
    closing: "It was great meeting you. See you around!",
  },

  cafe: {
    slug: "cafe",
    systemPrompt:
      "You are a friendly barista at a cozy café named Bean & Book. Keep replies to ONE short sentence in easy English. Help the customer order naturally.",
    opening: "Hi! Welcome to Bean & Book. What can I get you today?",
    turns: [
      [
        "Great choice! Would you like that hot or iced?",
        "Good pick! What size would you like?",
      ],
      [
        "Got it. Anything to eat with that? Our scones are popular.",
        "Okay. Would you like a snack too? We have muffins today.",
      ],
      [
        "That sounds good. That'll be $5.50.",
        "Nice. Can I get a name for your order?",
      ],
      [
        "Here you go! Is there anything else I can get you?",
        "All set! Let me know if you need anything else.",
      ],
      [
        "Thanks! Enjoy your drink.",
        "Have a great day! Come back soon.",
      ],
    ],
    closing: "Thanks! Have a great day.",
  },

  "study-abroad": {
    slug: "study-abroad",
    systemPrompt:
      "You are a friendly international student who has become the user's friend. Chat casually. Keep replies to ONE short sentence in easy English. Ask ONE question per turn.",
    opening: "Hey! How's your day been?",
    turns: [
      [
        "Oh nice. Did you eat anything good today?",
        "Cool! What did you do today?",
      ],
      [
        "That sounds yummy. What's your favorite food?",
        "Awesome. I'm getting hungry. Any food you recommend?",
      ],
      [
        "Noted! Hey, do you have plans this weekend?",
        "Good to know! What are you up to this weekend?",
      ],
      [
        "That sounds fun! Do you want to hang out sometime?",
        "Nice! Want to do something together soon?",
      ],
      [
        "Cool! Let's figure out a time later. See you!",
        "Great. I'll text you. See you around!",
      ],
    ],
    closing: "Talk to you later!",
  },
};

export function getScenarioOpening(slug: string): string {
  return SCENARIOS[slug]?.opening ?? "Hi! How are you today?";
}

export function getScenarioClosing(slug: string): string {
  return SCENARIOS[slug]?.closing ?? "Thanks for chatting!";
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function scriptedReply(slug: string, history: ChatTurn[]): string {
  const scenario = SCENARIOS[slug] ?? SCENARIOS["first-meeting"];
  const assistantCount = history.filter((m) => m.role === "assistant").length;
  // We have already emitted the opening at turn-count 1 (when session starts),
  // so assistantCount >= 1 when we're producing the next reply. Script is 0-indexed
  // into subsequent replies.
  const scriptIdx = Math.max(0, assistantCount - 1);

  let reply: string;
  if (scriptIdx < scenario.turns.length) {
    const choices = scenario.turns[scriptIdx];
    const userLast = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    reply = choices[hashString(userLast) % choices.length];
  } else {
    reply = scenario.closing;
  }

  // Very light reactive adjustment: if user asked a question, prepend a tiny acknowledgment.
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  if (lastUser.trim().endsWith("?")) {
    reply = "Good question! " + reply;
  }
  return reply;
}

// ————————————————————————————————————————————————————————————
// OpenAI integration (optional)
// ————————————————————————————————————————————————————————————

async function openaiReply(slug: string, history: ChatTurn[]): Promise<string | null> {
  const { getApiKey } = await import("@/lib/settings");
  const apiKey = await getApiKey("openai");
  if (!apiKey) return null;
  const scenario = SCENARIOS[slug] ?? SCENARIOS["first-meeting"];

  try {
    const messages = [
      { role: "system", content: scenario.systemPrompt },
      ...history
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 120,
        messages,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function generateAIResponse(
  scenarioSlug: string,
  history: ChatTurn[],
): Promise<string> {
  const llm = await openaiReply(scenarioSlug, history);
  if (llm) return llm;
  return scriptedReply(scenarioSlug, history);
}
