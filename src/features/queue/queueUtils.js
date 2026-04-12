import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
} from "discord.js";

import {
  QUEUE_BUTTON_PREFIX,
  QUEUE_MAX_LIMIT,
  QUEUE_MAX_TIMEOUT_MINUTES,
  QUEUE_MIN_LIMIT,
  QUEUE_MIN_TIMEOUT_MINUTES,
} from "./queueConstants.js";

export function parseQueueCreateModalCustomId(customId) {
  const [scope, action, guildId, channelId, creatorUserId, mentionRoleIdRaw] =
    customId.split(":");
  const mentionRoleId =
    mentionRoleIdRaw && /^\d+$/.test(mentionRoleIdRaw)
      ? mentionRoleIdRaw
      : null;

  if (
    scope !== "dongbot" ||
    action !== "queue-create" ||
    !guildId ||
    !channelId ||
    !creatorUserId
  ) {
    return null;
  }

  return {
    guildId,
    channelId,
    creatorUserId,
    mentionRoleId,
  };
}

export function parseQueueLimitInput(rawInput) {
  const normalized = rawInput.trim();

  if (!/^\d+$/.test(normalized)) {
    return {
      limit: null,
      error: `모집 인원은 ${QUEUE_MIN_LIMIT}~${QUEUE_MAX_LIMIT} 사이 숫자로 입력해 주세요.`,
    };
  }

  const limit = Number.parseInt(normalized, 10);

  if (limit < QUEUE_MIN_LIMIT || limit > QUEUE_MAX_LIMIT) {
    return {
      limit: null,
      error: `모집 인원은 ${QUEUE_MIN_LIMIT}~${QUEUE_MAX_LIMIT} 사이로 설정해 주세요.`,
    };
  }

  return {
    limit,
    error: null,
  };
}

export function parseQueueTimeoutInput(rawInput) {
  const normalized = rawInput.trim();

  if (!/^\d+$/.test(normalized)) {
    return {
      timeoutMinutes: null,
      error:
        `시간 제한은 ${QUEUE_MIN_TIMEOUT_MINUTES}~${QUEUE_MAX_TIMEOUT_MINUTES} 사이 숫자로 입력해 주세요.`,
    };
  }

  const timeoutMinutes = Number.parseInt(normalized, 10);

  if (
    timeoutMinutes < QUEUE_MIN_TIMEOUT_MINUTES ||
    timeoutMinutes > QUEUE_MAX_TIMEOUT_MINUTES
  ) {
    return {
      timeoutMinutes: null,
      error:
        `시간 제한은 ${QUEUE_MIN_TIMEOUT_MINUTES}~${QUEUE_MAX_TIMEOUT_MINUTES}분 사이로 설정해 주세요.`,
    };
  }

  return {
    timeoutMinutes,
    error: null,
  };
}

export function createQueueId() {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `q${Date.now().toString(36)}${randomSuffix}`;
}

export function isQueueTextChannel(channel) {
  return (
    channel?.type === ChannelType.GuildText ||
    channel?.type === ChannelType.GuildAnnouncement
  );
}

export function buildQueueMessagePayload(queue) {
  const participants = Array.isArray(queue.participants) ? queue.participants : [];
  const timeLimitText = Number.isInteger(queue.timeoutMinutes)
    ? `${queue.timeoutMinutes}분`
    : "미설정";
  const endTimeText = resolveQueueEndTimeText(queue);
  const participantLines = participants.length
    ? participants.map((userId, index) => `${index + 1}. <@${userId}>`).join("\n")
    : "아직 참가자가 없습니다.";

  const descriptionLines = [
    `현재 인원: **${participants.length}/${queue.limit}**`,
    "",
    `참가자:\n${participantLines}`,
  ];

  if (queue.note) {
    descriptionLines.push("", `안내: ${queue.note}`);
  }

  descriptionLines.push("", queue.status === "open" ? "모집 진행 중" : "모집 마감");

  const embed = new EmbedBuilder()
    .setColor(queue.status === "open" ? 0x1abc9c : 0xe74c3c)
    .setTitle(`⏱ ${queue.title}`)
    .setDescription(descriptionLines.join("\n").slice(0, 4096))
    .addFields(
      {
        name: "생성자",
        value: `<@${queue.creatorUserId}>`,
        inline: true,
      },
      {
        name: "모집 인원",
        value: `${queue.limit}명`,
        inline: true,
      },
      {
        name: "상태",
        value: queue.status === "open" ? "진행 중" : "마감",
        inline: true,
      },
      {
        name: "멘션 역할",
        value: queue.mentionRoleId ? `<@&${queue.mentionRoleId}>` : "없음",
        inline: true,
      },
      {
        name: "시간 제한",
        value: timeLimitText,
        inline: true,
      },
      {
        name: "마감 예정",
        value: endTimeText,
        inline: true,
      },
    )
    .setTimestamp(
      queue.status === "closed" && queue.closedAtMs
        ? new Date(queue.closedAtMs)
        : new Date(queue.createdAtMs),
    )
    .setFooter({
      text: "참가/나가기 버튼으로 선착순을 관리할 수 있어요.",
    });

  if (queue.status === "closed" && queue.closedByUserId) {
    embed.addFields({
      name: "마감자",
      value: `<@${queue.closedByUserId}>`,
      inline: true,
    });
  }

  return {
    embeds: [embed],
    components: buildQueueComponents(queue),
  };
}

export function buildQueueStatusEmbed(queue, title) {
  const participants = Array.isArray(queue.participants) ? queue.participants : [];
  const timeLimitText = Number.isInteger(queue.timeoutMinutes)
    ? `${queue.timeoutMinutes}분`
    : "미설정";
  const endTimeText = resolveQueueEndTimeText(queue);
  const participantLines = participants.length
    ? participants.map((userId, index) => `${index + 1}. <@${userId}>`).join("\n")
    : "아직 참가자가 없습니다.";

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(title)
    .setDescription(participantLines.slice(0, 4096))
    .addFields(
      {
        name: "현재 인원",
        value: `${participants.length}/${queue.limit}`,
        inline: true,
      },
      {
        name: "상태",
        value: queue.status === "open" ? "진행 중" : "마감",
        inline: true,
      },
      {
        name: "생성자",
        value: `<@${queue.creatorUserId}>`,
        inline: true,
      },
      {
        name: "멘션 역할",
        value: queue.mentionRoleId ? `<@&${queue.mentionRoleId}>` : "없음",
        inline: true,
      },
      {
        name: "시간 제한",
        value: timeLimitText,
        inline: true,
      },
      {
        name: "마감 예정",
        value: endTimeText,
        inline: true,
      },
    )
    .setTimestamp();
}

function formatQueueEndTime(expiresAtMs) {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
    return "미설정";
  }

  const unixSeconds = Math.floor(expiresAtMs / 1000);
  return `<t:${unixSeconds}:R> (<t:${unixSeconds}:t>)`;
}

function resolveQueueEndTimeText(queue) {
  if (queue.status === "closed" && Number.isFinite(queue.closedAtMs)) {
    const closedAtSeconds = Math.floor(queue.closedAtMs / 1000);
    return `마감됨 (<t:${closedAtSeconds}:t>)`;
  }

  return formatQueueEndTime(queue.expiresAtMs);
}

function buildQueueComponents(queue) {
  const participants = Array.isArray(queue.participants) ? queue.participants : [];
  const isClosed = queue.status === "closed";
  const isFull = participants.length >= queue.limit;

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${QUEUE_BUTTON_PREFIX}join:${queue.queueId}`)
        .setLabel("참가")
        .setStyle(ButtonStyle.Success)
        .setDisabled(isClosed || isFull),
      new ButtonBuilder()
        .setCustomId(`${QUEUE_BUTTON_PREFIX}leave:${queue.queueId}`)
        .setLabel("나가기")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(isClosed),
      new ButtonBuilder()
        .setCustomId(`${QUEUE_BUTTON_PREFIX}end:${queue.queueId}`)
        .setLabel("마감")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(isClosed),
    ),
  ];
}
