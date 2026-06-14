import { PrismaClient } from "@prisma/client";
import { SEED_VOCABULARY } from "../lib/vocabulary-dictionary";
import { QUEST_CATALOG } from "../lib/quest-engine";
import { getScenarioOpening } from "../lib/ai";

const prisma = new PrismaClient();

const SCENARIOS = [
  {
    slug: "first-meeting",
    name: "はじめての出会い",
    description: "初対面のカジュアルな会話。自己紹介をして相手のことを知りましょう。",
    goal: "名前・出身・好きなことを伝え、相手にも質問してみましょう。",
    focusFunctions: ["self_introduction", "question_back", "impression", "follow_up_question"],
    recommendedQuestSlugs: ["new_expression", "function_question_back", "continuation_6"],
  },
  {
    slug: "cafe",
    name: "カフェにて",
    description: "居心地の良いカフェで飲み物と軽食を注文しましょう。",
    goal: "丁寧に注文し、質問を投げ、好みを伝え、店員の提案にリアクションを返しましょう。",
    focusFunctions: ["impression", "invitation", "agreement", "follow_up_question"],
    recommendedQuestSlugs: ["variation_good", "function_impression", "new_expression"],
  },
  {
    slug: "study-abroad",
    name: "留学先の友達",
    description: "留学先で出会った友達との近況トーク。今日のことや週末の話をしましょう。",
    goal: "日常を共有し、ちょっとした予定を立て、自然にリアクションして、追加の質問を投げましょう。",
    focusFunctions: ["back_channel", "follow_up_question", "invitation", "topic_expansion"],
    recommendedQuestSlugs: ["function_back_channel", "function_follow_up", "variation_like"],
  },
];

async function main() {
  console.log("Seeding LexQuest...");

  // Default user
  const user = await prisma.user.upsert({
    where: { id: "default-user" },
    update: { displayName: "旅人" },
    create: {
      id: "default-user",
      displayName: "旅人",
    },
  });
  console.log(`User: ${user.displayName}`);

  // Scenarios
  for (const s of SCENARIOS) {
    await prisma.scenario.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        description: s.description,
        goal: s.goal,
        focusFunctions: JSON.stringify(s.focusFunctions),
        recommendedQuestSlugs: JSON.stringify(s.recommendedQuestSlugs),
        openingLine: getScenarioOpening(s.slug),
      },
      create: {
        slug: s.slug,
        name: s.name,
        description: s.description,
        goal: s.goal,
        focusFunctions: JSON.stringify(s.focusFunctions),
        recommendedQuestSlugs: JSON.stringify(s.recommendedQuestSlugs),
        openingLine: getScenarioOpening(s.slug),
      },
    });
  }
  console.log(`Scenarios: ${SCENARIOS.length}`);

  // Vocabulary items
  let created = 0;
  for (const v of SEED_VOCABULARY) {
    await prisma.vocabularyItem.upsert({
      where: { normalizedText: v.normalizedText },
      update: {
        displayText: v.displayText,
        category: v.category,
        meaningGroup: v.meaningGroup ?? null,
        functionType: v.functionType ?? null,
        alternatives: JSON.stringify(v.alternatives ?? []),
      },
      create: {
        normalizedText: v.normalizedText,
        displayText: v.displayText,
        category: v.category,
        meaningGroup: v.meaningGroup ?? null,
        functionType: v.functionType ?? null,
        alternatives: JSON.stringify(v.alternatives ?? []),
      },
    });
    created++;
  }
  console.log(`Vocabulary items: ${created}`);

  // Quests
  for (const q of QUEST_CATALOG) {
    await prisma.quest.upsert({
      where: { slug: q.slug },
      update: {
        type: q.type,
        title: q.title,
        description: q.description,
        targetJson: JSON.stringify(q.target),
        rewardXp: q.rewardXp,
        active: true,
      },
      create: {
        slug: q.slug,
        type: q.type,
        title: q.title,
        description: q.description,
        targetJson: JSON.stringify(q.target),
        rewardXp: q.rewardXp,
        active: true,
      },
    });
  }
  console.log(`Quests: ${QUEST_CATALOG.length}`);

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
