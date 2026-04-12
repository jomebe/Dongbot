import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
} from "discord.js";

import {
  POLL_BUTTON_PREFIX,
  POLL_MAX_OPTIONS,
  POLL_MAX_VISIBLE_VOTERS,
  POLL_VISIBILITY_ANONYMOUS,
  POLL_VISIBILITY_PUBLIC,
} from "./pollConstants.js";

export function parsePollCreateModalCustomId(customId) {
  const [scope, action, guildId, channelId, visibility, creatorUserId] =
    customId.split(":");

  const isValidVisibility =
    visibility === POLL_VISIBILITY_ANONYMOUS ||
    visibility === POLL_VISIBILITY_PUBLIC;

  if (
    scope !== "dongbot" ||
    action !== "poll-create" ||
    !guildId ||
    !channelId ||
    !creatorUserId ||
    !isValidVisibility
  ) {
    return null;
  }

  return {
    guildId,
    channelId,
    creatorUserId,
    visibility,
  };
}

export function parsePollOptionsInput(rawInput) {
  const options = rawInput
    .split(/\r?\n/g)
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => option.slice(0, 80));

  if (options.length < 2) {
    return {
      options: [],
      error: "선택지는 최소 2개 이상 입력해 주세요.",
    };
  }

  if (options.length > POLL_MAX_OPTIONS) {
    return {
      options: [],
      error: `선택지는 최대 ${POLL_MAX_OPTIONS}개까지 입력할 수 있어요.`,
    };
  }

  return {
    options,
    error: null,
  };
}

export function createPollId() {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `p${Date.now().toString(36)}${randomSuffix}`;
}

export function isPollTextChannel(channel) {
  return (
    channel?.type === ChannelType.GuildText ||
    channel?.type === ChannelType.GuildAnnouncement
  );
}

export function buildPollMessagePayload(poll) {
  const summary = summarizePollVotes(poll);
  const lines = [];

  for (let index = 0; index < poll.options.length; index += 1) {
    const count = summary.counts[index];
    const percentage =
      summary.totalVotes === 0 ? "0.0" : ((count / summary.totalVotes) * 100).toFixed(1);

    lines.push(`${index + 1}. ${poll.options[index]} (${count}표, ${percentage}%)`);

    if (!poll.isAnonymous) {
      lines.push(`   투표자: ${formatPollVoterMentions(summary.votersByOption[index])}`);
    }
  }

  lines.push("");
  lines.push(poll.status === "open" ? "투표 진행 중" : "투표 종료");

  const embed = new EmbedBuilder()
    .setColor(poll.status === "open" ? 0x2ecc71 : 0xe74c3c)
    .setTitle(poll.topic)
    .setDescription(lines.join("\n").slice(0, 4096))
    .addFields(
      {
        name: "유형",
        value: poll.isAnonymous ? "익명투표" : "공개투표",
        inline: true,
      },
      {
        name: "작성자",
        value: `<@${poll.creatorUserId}>`,
        inline: true,
      },
      {
        name: "총 투표수",
        value: `${summary.totalVotes}표`,
        inline: true,
      },
    )
    .setTimestamp(
      poll.status === "closed" && poll.closedAtMs
        ? new Date(poll.closedAtMs)
        : new Date(poll.createdAtMs),
    );

  if (poll.status === "closed" && poll.closedByUserId) {
    embed.addFields({
      name: "종료자",
      value: `<@${poll.closedByUserId}>`,
      inline: true,
    });
  }

  return {
    embeds: [embed],
    components: buildPollComponents(poll),
  };
}

export function buildPollStatusEmbed(poll, title) {
  const summary = summarizePollVotes(poll);
  const lines = [];

  for (let index = 0; index < poll.options.length; index += 1) {
    const count = summary.counts[index];
    const percentage =
      summary.totalVotes === 0 ? "0.0" : ((count / summary.totalVotes) * 100).toFixed(1);

    lines.push(`${index + 1}. ${poll.options[index]} (${count}표, ${percentage}%)`);

    if (!poll.isAnonymous) {
      lines.push(`   투표자: ${formatPollVoterMentions(summary.votersByOption[index])}`);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(title)
    .setDescription(lines.join("\n").slice(0, 4096))
    .addFields(
      {
        name: "유형",
        value: poll.isAnonymous ? "익명투표" : "공개투표",
        inline: true,
      },
      {
        name: "상태",
        value: poll.status === "open" ? "진행 중" : "종료됨",
        inline: true,
      },
      {
        name: "총 투표수",
        value: `${summary.totalVotes}표`,
        inline: true,
      },
    );

  if (title.includes("결과")) {
    if (summary.totalVotes === 0) {
      embed.addFields({
        name: "결과 요약",
        value: "아직 투표가 없어요.",
        inline: false,
      });
    } else {
      const maxCount = Math.max(...summary.counts);
      const winnerLabels = summary.counts
        .map((count, index) =>
          count === maxCount ? `${index + 1}번 ${poll.options[index]}` : null,
        )
        .filter(Boolean)
        .join(", ");

      embed.addFields({
        name: "결과 요약",
        value: `최다 득표: ${winnerLabels} (${maxCount}표)`,
        inline: false,
      });
    }
  }

  return embed;
}

function summarizePollVotes(poll) {
  const counts = Array.from({ length: poll.options.length }, () => 0);
  const votersByOption = Array.from({ length: poll.options.length }, () => []);

  for (const [userId, selectedIndexRaw] of Object.entries(poll.votesByUser ?? {})) {
    const selectedIndex = Number(selectedIndexRaw);

    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= poll.options.length
    ) {
      continue;
    }

    counts[selectedIndex] += 1;
    votersByOption[selectedIndex].push(userId);
  }

  const totalVotes = counts.reduce((sum, count) => sum + count, 0);

  return {
    counts,
    votersByOption,
    totalVotes,
  };
}

function formatPollVoterMentions(userIds) {
  if (userIds.length === 0) {
    return "없음";
  }

  const visibleMentions = userIds
    .slice(0, POLL_MAX_VISIBLE_VOTERS)
    .map((userId) => `<@${userId}>`)
    .join(", ");

  if (userIds.length > POLL_MAX_VISIBLE_VOTERS) {
    return `${visibleMentions} 외 ${userIds.length - POLL_MAX_VISIBLE_VOTERS}명`;
  }

  return visibleMentions;
}

function buildPollComponents(poll) {
  const rows = [];

  for (let start = 0; start < poll.options.length; start += 5) {
    const row = new ActionRowBuilder();

    for (let index = start; index < Math.min(start + 5, poll.options.length); index += 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${POLL_BUTTON_PREFIX}vote:${poll.pollId}:${index}`)
          .setLabel(`${index + 1}번`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(poll.status === "closed"),
      );
    }

    rows.push(row);
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${POLL_BUTTON_PREFIX}result:${poll.pollId}`)
        .setLabel("투표 결과")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${POLL_BUTTON_PREFIX}end:${poll.pollId}`)
        .setLabel("투표 종료")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(poll.status === "closed"),
    ),
  );

  return rows.slice(0, 5);
}
