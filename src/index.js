import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  Partials,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

import {
  discordToken,
  roomGeneratorChannelName,
  roomPrefix,
} from "./config.js";
import {
  addManagedChannel,
  disableRoomGenerator,
  enableRoomGenerator,
  ensureGuildConfig,
  getGuildConfig,
  removeManagedChannel,
} from "./store/guildConfigStore.js";
import {
  getEnabledTtsConfigsInGuild,
  getUserTtsConfig,
  hasEnabledTtsUsersInGuild,
  setUserTtsEnabled,
  setUserTtsVoice,
} from "./store/ttsConfigStore.js";
import {
  getTtsGuildConfig,
  updateTtsGuildConfig,
  TTS_GUILD_INPUT_MODE_CHANNEL,
  TTS_GUILD_INPUT_MODE_GUILD,
} from "./store/ttsGuildConfigStore.js";
import {
  getLoggingConfig,
  updateLoggingConfig,
} from "./store/loggingConfigStore.js";
import {
  createPollRecord,
  getPollRecord,
  savePollRecord,
} from "./store/pollStore.js";
import {
  createQueueRecord,
  getOpenQueueByGuildId,
  getQueueRecord,
  saveQueueRecord,
} from "./store/queueStore.js";
import {
  getAutoRoleConfig,
  updateAutoRoleConfig,
} from "./store/autoRoleConfigStore.js";
import {
  getProfanityConfig,
  setProfanityChannelEnabled,
  updateProfanityConfig,
} from "./store/profanityConfigStore.js";
import {
  createReactionRolePanel,
  getReactionRolePanel,
  removeReactionRolePanel,
} from "./store/reactionRoleStore.js";
import {
  POLL_BUTTON_PREFIX,
  POLL_COMMAND_NAME,
  POLL_CREATE_MODAL_PREFIX,
  POLL_OPTIONS_FIELD_ID,
  POLL_SUBJECT_FIELD_ID,
  POLL_VISIBILITY_ANONYMOUS,
  POLL_VISIBILITY_PUBLIC,
} from "./features/poll/pollConstants.js";
import {
  QUEUE_BUTTON_PREFIX,
  QUEUE_COMMAND_NAME,
  QUEUE_CREATE_SUBCOMMAND_NAME,
  QUEUE_CREATE_MODAL_PREFIX,
  QUEUE_LIMIT_FIELD_ID,
  QUEUE_NOTE_FIELD_ID,
  QUEUE_STATUS_SUBCOMMAND_NAME,
  QUEUE_TIMEOUT_FIELD_ID,
  QUEUE_TITLE_FIELD_ID,
} from "./features/queue/queueConstants.js";
import {
  buildPollMessagePayload,
  buildPollStatusEmbed,
  createPollId,
  isPollTextChannel,
  parsePollCreateModalCustomId,
  parsePollOptionsInput,
} from "./features/poll/pollUtils.js";
import {
  buildQueueMessagePayload,
  buildQueueStatusEmbed,
  createQueueId,
  isQueueTextChannel,
  parseQueueCreateModalCustomId,
  parseQueueLimitInput,
  parseQueueTimeoutInput,
} from "./features/queue/queueUtils.js";
import {
  containsProfanity,
} from "./features/profanity/profanityUtils.js";
import {
  safeDeferEphemeral,
  safeInteractionDeleteReply,
  safeInteractionEditReply,
  safeInteractionReply,
} from "./utils/interactionUtils.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const guildTaskQueue = new Map();
const queueTimeoutJobs = new Map();

const ROOM_SETUP_BUTTON_PREFIX = "dongbot:room-setup:";
const ROOM_CATEGORY_SELECT_PREFIX = "dongbot:room-category:";
const ROOT_CATEGORY_VALUE = "dongbot:root-category";
const CALL_ROOM_COMMAND_NAME = "통화방";
const TTS_COMMAND_NAME = "tts";
const TTS_TEST_COMMAND_NAME = "ttstest";
const SETUP_COMMAND_NAME = "초기설정";
const TTS_ACTION_SUBCOMMAND_NAME = "실행";
const TTS_TEST_RUN_SUBCOMMAND_NAME = "실행";
const SETUP_OPEN_SUBCOMMAND_NAME = "열기";
const POLL_CREATE_SUBCOMMAND_NAME = "생성";
const TTS_LANGUAGE_SELECT_PREFIX = "dongbot:tts-language:";
const SETUP_CHAT_LOG_ENABLE_PREFIX = "dongbot:setup-chatlog-enable:";
const SETUP_CHAT_LOG_DISABLE_PREFIX = "dongbot:setup-chatlog-disable:";
const SETUP_CHAT_LOG_CHANNEL_PREFIX = "dongbot:setup-chatlog-channel:";
const SETUP_LOGS_BOOTSTRAP_PREFIX = "dongbot:setup-logs-bootstrap:";
const SETUP_ROOM_ENABLE_PREFIX = "dongbot:setup-room-enable:";
const SETUP_ROOM_DISABLE_PREFIX = "dongbot:setup-room-disable:";
const SETUP_ROOM_SETTINGS_BUTTON_PREFIX = "dongbot:setup-room-settings-open:";
const SETUP_ROOM_CATEGORY_PREFIX = "dongbot:setup-room-category:";
const SETUP_JOIN_LEAVE_ENABLE_PREFIX = "dongbot:setup-joinleave-enable:";
const SETUP_JOIN_LEAVE_DISABLE_PREFIX = "dongbot:setup-joinleave-disable:";
const SETUP_JOIN_LEAVE_SETTINGS_BUTTON_PREFIX =
  "dongbot:setup-joinleave-settings-open:";
const SETUP_JOIN_LEAVE_CHANNEL_PREFIX = "dongbot:setup-joinleave-channel:";
const SETUP_JOIN_LEAVE_ALERT_BUTTON_PREFIX =
  "dongbot:setup-joinleave-alert-open:";
const SETUP_JOIN_LEAVE_ALERT_MODAL_PREFIX =
  "dongbot:setup-joinleave-alert-modal:";
const SETUP_CHAT_LOG_SETTINGS_BUTTON_PREFIX =
  "dongbot:setup-chatlog-settings-open:";
const SETUP_TTS_MODE_CHANNEL_PREFIX = "dongbot:setup-tts-mode-channel:";
const SETUP_TTS_MODE_GUILD_PREFIX = "dongbot:setup-tts-mode-guild:";
const SETUP_TTS_SETTINGS_BUTTON_PREFIX = "dongbot:setup-tts-settings-open:";
const SETUP_TTS_CHANNEL_PREFIX = "dongbot:setup-tts-channel:";
const SETUP_AUTO_ROLE_ENABLE_PREFIX = "dongbot:setup-autorole-enable:";
const SETUP_AUTO_ROLE_DISABLE_PREFIX = "dongbot:setup-autorole-disable:";
const SETUP_AUTO_ROLE_SETTINGS_BUTTON_PREFIX =
  "dongbot:setup-autorole-settings-open:";
const SETUP_AUTO_ROLE_ROLE_PREFIX = "dongbot:setup-autorole-role:";
const ROLE_PANEL_COMMAND_NAME = "역할지급";
const ROLE_PANEL_CREATE_SUBCOMMAND_NAME = "패널생성";
const PROFANITY_COMMAND_NAME = "욕설감지";
const PROFANITY_CHANNEL_GROUP_NAME = "채널";
const PROFANITY_WORD_GROUP_NAME = "단어";
const PROFANITY_EXCEPTION_GROUP_NAME = "예외";
const PROFANITY_ENABLE_SUBCOMMAND_NAME = "켜기";
const PROFANITY_DISABLE_SUBCOMMAND_NAME = "끄기";
const PROFANITY_STATUS_SUBCOMMAND_NAME = "상태";
const PROFANITY_ADD_SUBCOMMAND_NAME = "추가";
const PROFANITY_REMOVE_SUBCOMMAND_NAME = "삭제";
const PROFANITY_LIST_SUBCOMMAND_NAME = "목록";
const MAX_TTS_TEXT_LENGTH = 180;
const DEFAULT_TTS_TEST_TEXT = "테스트 메시지입니다. 지금 읽히면 TTS가 정상 동작 중입니다.";
const TTS_PLAYBACK_START_TIMEOUT_MS = 15_000;
const TTS_PLAYBACK_END_TIMEOUT_MS = 120_000;
const TTS_OUTPUT_FORMAT_FALLBACKS = [
  OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
  OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS,
];
const JOIN_LEAVE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_TTS_TEXT_CHANNEL_NAME = "🔊 | tts-채팅방";
const LEGACY_TTS_TEXT_CHANNEL_NAMES = [
  "tts-채팅방",
  "🔊｜tts-채팅방",
  "🔊 | tts-채팅방",
];
const DEFAULT_CHAT_LOG_CHANNEL_NAME = "채팅-로그";
const DEFAULT_JOIN_LEAVE_LOG_CHANNEL_NAME = "들낙-로그";
const DEFAULT_LOG_CATEGORY_NAME = "로그";
const DEFAULT_CHAT_LOG_CHANNEL_PRESET_NAME = "📜 | 채팅-로그";
const DEFAULT_JOIN_LEAVE_LOG_CHANNEL_PRESET_NAME = "📖 | 들낙-로그";
const LEGACY_CHAT_LOG_CHANNEL_NAMES = [
  DEFAULT_CHAT_LOG_CHANNEL_NAME,
  "📜｜채팅-로그",
  "📜 | 채팅-로그",
];
const LEGACY_JOIN_LEAVE_LOG_CHANNEL_NAMES = [
  DEFAULT_JOIN_LEAVE_LOG_CHANNEL_NAME,
  "📖｜들낙-로그",
  "📖 | 들낙-로그",
];

const TTS_LANGUAGE_OPTIONS = [
  {
    label: "한국어",
    description: "한국어 기본 음성",
    value: "ko-KR-SunHiNeural",
  },
  {
    label: "English",
    description: "US English voice",
    value: "en-US-JennyNeural",
  },
  {
    label: "日本語",
    description: "Japanese voice",
    value: "ja-JP-NanamiNeural",
  },
  {
    label: "中文",
    description: "Chinese voice",
    value: "zh-CN-XiaoxiaoNeural",
  },
];

const ttsVoiceLabelMap = new Map(
  TTS_LANGUAGE_OPTIONS.map((option) => [option.value, option.label]),
);
const ttsLanguageAliasToVoice = new Map([
  ["한국어", "ko-KR-SunHiNeural"],
  ["ko", "ko-KR-SunHiNeural"],
  ["korean", "ko-KR-SunHiNeural"],
  ["english", "en-US-JennyNeural"],
  ["en", "en-US-JennyNeural"],
  ["영어", "en-US-JennyNeural"],
  ["일본어", "ja-JP-NanamiNeural"],
  ["일어", "ja-JP-NanamiNeural"],
  ["japanese", "ja-JP-NanamiNeural"],
  ["ja", "ja-JP-NanamiNeural"],
  ["중국어", "zh-CN-XiaoxiaoNeural"],
  ["중어", "zh-CN-XiaoxiaoNeural"],
  ["chinese", "zh-CN-XiaoxiaoNeural"],
  ["zh", "zh-CN-XiaoxiaoNeural"],
]);

const ttsRuntimeByGuild = new Map();
const handledTtsVoiceConnections = new WeakSet();
const joinLeaveEventHistory = new Map();

const callRoomCommand = new SlashCommandBuilder()
  .setName(CALL_ROOM_COMMAND_NAME)
  .setDescription("현재 참여 중인 통화방을 수정합니다")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("인원")
      .setDescription("현재 통화방 최대 인원을 변경합니다")
      .addIntegerOption((option) =>
        option
          .setName("값")
          .setDescription("0부터 99까지 입력하세요. 0은 무제한입니다")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(99),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("이름")
      .setDescription("현재 통화방 이름을 변경합니다")
      .addStringOption((option) =>
        option
          .setName("값")
          .setDescription("새 통화방 이름")
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(100),
      ),
  );

const ttsCommand = new SlashCommandBuilder()
  .setName(TTS_COMMAND_NAME)
  .setDescription("현재 참여 중인 음성 채널에서 TTS를 제어합니다")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName(TTS_ACTION_SUBCOMMAND_NAME)
      .setDescription("O, X, 설정 또는 설정 언어(예: 설정 한국어)")
      .addStringOption((option) =>
        option
          .setName("동작")
          .setDescription("O, X, 설정 또는 설정 언어(예: 설정 한국어)")
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(40),
      ),
  );

const ttsTestCommand = new SlashCommandBuilder()
  .setName(TTS_TEST_COMMAND_NAME)
  .setDescription("현재 참여 중인 음성 채널에서 TTS 강제 재생을 테스트합니다")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName(TTS_TEST_RUN_SUBCOMMAND_NAME)
      .setDescription("TTS 강제 재생 테스트 실행")
      .addStringOption((option) =>
        option
          .setName("문장")
          .setDescription("테스트로 읽을 문장")
          .setRequired(false)
          .setMinLength(1)
          .setMaxLength(MAX_TTS_TEXT_LENGTH),
      )
      .addStringOption((option) =>
        option
          .setName("언어")
          .setDescription("테스트 음성 언어")
          .setRequired(false)
          .addChoices(
            ...TTS_LANGUAGE_OPTIONS.map((voiceOption) => ({
              name: voiceOption.label,
              value: voiceOption.value,
            })),
          ),
      ),
  );

const setupCommand = new SlashCommandBuilder()
  .setName(SETUP_COMMAND_NAME)
  .setDescription("로그 기능 포함 초기설정을 다시 진행합니다")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName(SETUP_OPEN_SUBCOMMAND_NAME)
      .setDescription("초기설정 패널을 엽니다"),
  );

const pollCommand = new SlashCommandBuilder()
  .setName(POLL_COMMAND_NAME)
  .setDescription("특정 채널에 투표를 생성합니다")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName(POLL_CREATE_SUBCOMMAND_NAME)
      .setDescription("새 투표를 만듭니다")
      .addChannelOption((option) =>
        option
          .setName("채널")
          .setDescription("투표 메시지를 보낼 채널")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      )
      .addStringOption((option) =>
        option
          .setName("유형")
          .setDescription("익명투표 또는 공개투표")
          .setRequired(false)
          .addChoices(
            { name: "익명투표", value: POLL_VISIBILITY_ANONYMOUS },
            { name: "공개투표", value: POLL_VISIBILITY_PUBLIC },
          ),
      ),
  );

const queueCommand = new SlashCommandBuilder()
  .setName(QUEUE_COMMAND_NAME)
  .setDescription("선착순 기능")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName(QUEUE_CREATE_SUBCOMMAND_NAME)
      .setDescription("선착순 모집을 생성합니다")
      .addRoleOption((option) =>
        option
          .setName("멘션역할")
          .setDescription("모집 시작 시 멘션할 역할 (선택)")
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName(QUEUE_STATUS_SUBCOMMAND_NAME)
      .setDescription("현재 진행 중인 선착순 현황을 확인합니다"),
  );

const rolePanelCommand = new SlashCommandBuilder()
  .setName(ROLE_PANEL_COMMAND_NAME)
  .setDescription("반응으로 역할을 지급하는 패널을 만듭니다")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName(ROLE_PANEL_CREATE_SUBCOMMAND_NAME)
      .setDescription("특정 채널에 반응 역할 패널 생성")
      .addChannelOption((option) =>
        option
          .setName("채널")
          .setDescription("패널을 보낼 채널")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      )
      .addRoleOption((option) =>
        option
          .setName("역할")
          .setDescription("반응 시 지급할 역할")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("이모지")
          .setDescription("반응 이모지 (기본: ✅)")
          .setRequired(false)
          .setMaxLength(32),
      )
      .addStringOption((option) =>
        option
          .setName("제목")
          .setDescription("패널 제목")
          .setRequired(false)
          .setMinLength(1)
          .setMaxLength(80),
      )
      .addStringOption((option) =>
        option
          .setName("안내")
          .setDescription("패널 안내 문구")
          .setRequired(false)
          .setMinLength(1)
          .setMaxLength(300),
      ),
  );

const profanityCommand = new SlashCommandBuilder()
  .setName(PROFANITY_COMMAND_NAME)
  .setDescription("현재 채널 욕설 감지 삭제 기능을 설정합니다")
  .setDMPermission(false)
  .addSubcommandGroup((group) =>
    group
      .setName(PROFANITY_CHANNEL_GROUP_NAME)
      .setDescription("채널별 욕설감지 ON/OFF")
      .addSubcommand((subcommand) =>
        subcommand
          .setName(PROFANITY_ENABLE_SUBCOMMAND_NAME)
          .setDescription("현재 채널에서 욕설 감지를 켭니다"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName(PROFANITY_DISABLE_SUBCOMMAND_NAME)
          .setDescription("현재 채널에서 욕설 감지를 끕니다"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName(PROFANITY_STATUS_SUBCOMMAND_NAME)
          .setDescription("현재 채널 욕설 감지 상태를 확인합니다"),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName(PROFANITY_WORD_GROUP_NAME)
      .setDescription("서버 커스텀 금칙어 관리")
      .addSubcommand((subcommand) =>
        subcommand
          .setName(PROFANITY_ADD_SUBCOMMAND_NAME)
          .setDescription("금칙어를 추가합니다")
          .addStringOption((option) =>
            option
              .setName("값")
              .setDescription("추가할 단어")
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(30),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName(PROFANITY_REMOVE_SUBCOMMAND_NAME)
          .setDescription("금칙어를 삭제합니다")
          .addStringOption((option) =>
            option
              .setName("값")
              .setDescription("삭제할 단어")
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(30),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName(PROFANITY_LIST_SUBCOMMAND_NAME)
          .setDescription("등록된 금칙어 목록을 확인합니다"),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName(PROFANITY_EXCEPTION_GROUP_NAME)
      .setDescription("감지 예외 단어 관리")
      .addSubcommand((subcommand) =>
        subcommand
          .setName(PROFANITY_ADD_SUBCOMMAND_NAME)
          .setDescription("예외 단어를 추가합니다")
          .addStringOption((option) =>
            option
              .setName("값")
              .setDescription("예외 처리할 단어")
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(30),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName(PROFANITY_REMOVE_SUBCOMMAND_NAME)
          .setDescription("예외 단어를 삭제합니다")
          .addStringOption((option) =>
            option
              .setName("값")
              .setDescription("예외 목록에서 삭제할 단어")
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(30),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName(PROFANITY_LIST_SUBCOMMAND_NAME)
          .setDescription("등록된 예외 단어 목록을 확인합니다"),
      ),
  );

client.once("clientReady", async () => {
  console.log(`동봇 로그인 완료: ${client.user.tag}`);
  await registerAllGuildCommands();
});

client.on("guildCreate", async (guild) => {
  try {
    await registerGuildCommands(guild);
    await ensureGuildConfig(guild.id);
    await sendSetupMessage(guild);
  } catch (error) {
    console.error("초기 설정 메시지 전송 실패", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === CALL_ROOM_COMMAND_NAME) {
        await handleCallRoomCommand(interaction);
        return;
      }

      if (interaction.commandName === TTS_COMMAND_NAME) {
        await handleTtsCommand(interaction);
        return;
      }

      if (interaction.commandName === TTS_TEST_COMMAND_NAME) {
        await handleTtsTestCommand(interaction);
        return;
      }

      if (interaction.commandName === SETUP_COMMAND_NAME) {
        await handleSetupCommand(interaction);
        return;
      }

      if (interaction.commandName === POLL_COMMAND_NAME) {
        await handlePollCommand(interaction);
        return;
      }

      if (interaction.commandName === QUEUE_COMMAND_NAME) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === QUEUE_STATUS_SUBCOMMAND_NAME) {
          await handleQueueStatusCommand(interaction);
          return;
        }

        await handleQueueCommand(interaction);
        return;
      }

      if (interaction.commandName === ROLE_PANEL_COMMAND_NAME) {
        await handleRolePanelCommand(interaction);
        return;
      }

      if (interaction.commandName === PROFANITY_COMMAND_NAME) {
        await handleProfanityCommand(interaction);
        return;
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith(POLL_CREATE_MODAL_PREFIX)) {
        await handlePollCreateModalSubmit(interaction);
        return;
      }

      if (interaction.customId.startsWith(QUEUE_CREATE_MODAL_PREFIX)) {
        await handleQueueCreateModalSubmit(interaction);
        return;
      }

      if (
        interaction.customId.startsWith(SETUP_JOIN_LEAVE_ALERT_MODAL_PREFIX)
      ) {
        await handleJoinLeaveAlertModalSubmit(interaction);
      }

      return;
    }

    if (interaction.isRoleSelectMenu()) {
      await handleSetupRoleSelectInteraction(interaction);
      return;
    }

    if (interaction.isChannelSelectMenu()) {
      await handleSetupChannelSelectInteraction(interaction);
      return;
    }

    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId.startsWith(POLL_BUTTON_PREFIX)) {
        await handlePollButtonInteraction(interaction);
        return;
      }

      if (customId.startsWith(QUEUE_BUTTON_PREFIX)) {
        await handleQueueButtonInteraction(interaction);
        return;
      }

      if (
        customId.startsWith(SETUP_TTS_MODE_CHANNEL_PREFIX) ||
        customId.startsWith(SETUP_TTS_MODE_GUILD_PREFIX)
      ) {
        await handleSetupTtsButtonInteraction(interaction);
        return;
      }

      if (
        customId.startsWith(SETUP_ROOM_ENABLE_PREFIX) ||
        customId.startsWith(SETUP_ROOM_DISABLE_PREFIX) ||
        customId.startsWith(SETUP_ROOM_SETTINGS_BUTTON_PREFIX) ||
        customId.startsWith(SETUP_LOGS_BOOTSTRAP_PREFIX) ||
        customId.startsWith(SETUP_CHAT_LOG_SETTINGS_BUTTON_PREFIX) ||
        customId.startsWith(SETUP_CHAT_LOG_ENABLE_PREFIX) ||
        customId.startsWith(SETUP_CHAT_LOG_DISABLE_PREFIX) ||
        customId.startsWith(SETUP_JOIN_LEAVE_ENABLE_PREFIX) ||
        customId.startsWith(SETUP_JOIN_LEAVE_DISABLE_PREFIX) ||
        customId.startsWith(SETUP_JOIN_LEAVE_SETTINGS_BUTTON_PREFIX) ||
        customId.startsWith(SETUP_TTS_SETTINGS_BUTTON_PREFIX) ||
        customId.startsWith(SETUP_AUTO_ROLE_ENABLE_PREFIX) ||
        customId.startsWith(SETUP_AUTO_ROLE_DISABLE_PREFIX) ||
        customId.startsWith(SETUP_AUTO_ROLE_SETTINGS_BUTTON_PREFIX) ||
        customId.startsWith(SETUP_JOIN_LEAVE_ALERT_BUTTON_PREFIX)
      ) {
        await handleSetupButtonInteraction(interaction);
        return;
      }
    }

    const isTtsLanguageSelect =
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith(TTS_LANGUAGE_SELECT_PREFIX);

    if (isTtsLanguageSelect) {
      await handleTtsLanguageSelect(interaction);
      return;
    }

    const isSetupButton =
      interaction.isButton() &&
      interaction.customId.startsWith(ROOM_SETUP_BUTTON_PREFIX);
    const isCategorySelect =
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith(ROOM_CATEGORY_SELECT_PREFIX);

    if (!isSetupButton && !isCategorySelect) {
      return;
    }

    const guildId = interaction.customId.split(":")[2];
    const selectedCategoryId = isCategorySelect
      ? interaction.values[0] === ROOT_CATEGORY_VALUE
        ? null
        : interaction.values[0]
      : undefined;

    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(interaction.user.id);
    const hasAdminPermission =
      guild.ownerId === interaction.user.id ||
      member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasAdminPermission) {
      await interaction.reply({
        content: "서버 관리자만 이 설정을 완료할 수 있어요.",
      });
      return;
    }

    const roomGeneratorChannel = await ensureRoomGeneratorChannel(
      guild,
      selectedCategoryId,
    );
    await enableRoomGenerator(
      guild.id,
      roomGeneratorChannel.id,
      roomGeneratorChannel.parentId ?? null,
    );

    const categorySummary = roomGeneratorChannel.parentId
      ? `<#${roomGeneratorChannel.parentId}> 카테고리에`
      : "카테고리 없이";

    await interaction.reply({
      content: `완료! ${categorySummary} ${roomGeneratorChannelName} 채널을 만들고 자동 음성 수다방을 생성할게요.`,
    });
  } catch (error) {
    console.error("인터랙션 처리 실패", error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({
          content: "요청을 처리하는 중 오류가 발생했어요. 다시 시도해 주세요.",
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => null);
    }
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const guildId = newState.guild.id;

  await runGuildTask(guildId, async () => {
    await handleJoinRoomGenerator(oldState, newState);
    await handleEmptyManagedChannel(oldState, newState);
    await handleVoiceJoinLeaveLog(oldState, newState);
  });
});

client.on("messageCreate", async (message) => {
  try {
    const wasDeletedByModeration = await handleProfanityModerationMessage(message);

    if (wasDeletedByModeration) {
      return;
    }

    await handleTtsMessage(message);
  } catch (error) {
    console.error("메시지 처리 실패", error);
  }
});

client.on("guildMemberAdd", async (member) => {
  try {
    await handleAutoRoleOnMemberJoin(member);
  } catch (error) {
    console.error("자동 역할 지급 실패", error);
  }
});

client.on("messageReactionAdd", async (reaction, user) => {
  try {
    await handleReactionRoleToggle(reaction, user, true);
  } catch (error) {
    console.error("반응 역할 지급 실패", error);
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  try {
    await handleReactionRoleToggle(reaction, user, false);
  } catch (error) {
    console.error("반응 역할 해제 실패", error);
  }
});

client.on("messageDelete", async (message) => {
  try {
    await handleMessageDeleteLog(message);
    await removeReactionRolePanel(message.id);
  } catch (error) {
    console.error("채팅 삭제 로그 처리 실패", error);
  }
});

async function sendSetupMessage(guild) {
  const owner = await guild.fetchOwner();
  const installer = await findBotInstallerMember(guild);
  const recipient = installer ?? owner;

  const embed = new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle("동봇 초기 설정")
    .setDescription(
      [
        "안녕하세요! 동봇입니다.",
        "",
        "방 생성 기능을 활성화하면 아래 흐름으로 동작해요:",
        `- ${roomGeneratorChannelName} 음성 채널 생성`,
        "- 초기 메시지에서 생성 카테고리 직접 선택 가능",
        `- 유저가 입장하면 ${roomPrefix} 1, 2, 3... 자동 생성`,
        "- 생성된 수다방이 비면 자동 삭제",
        "- 동봇이 만든 수다방만 삭제 (기준 채널은 유지)",
        "- /초기설정 명령어로 채팅로그/들낙로그 설정 가능",
      ].join("\n"),
    );

  const components = buildSetupComponents(guild);

  try {
    await recipient.send({
      embeds: [embed],
      components,
    });
  } catch (error) {
    const me = guild.members.me ?? (await guild.members.fetchMe());

    const fallbackChannel =
      guild.systemChannel ??
      guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildText &&
          channel
            .permissionsFor(me)
            ?.has([
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ]),
      );

    if (fallbackChannel?.isTextBased()) {
      await fallbackChannel.send({
        content: `<@${recipient.id}> DM을 보낼 수 없어 서버 채널에서 초기 설정을 도와드릴게요.`,
        embeds: [embed],
        components,
      });
      return;
    }

    console.warn(
      `서버 ${guild.id} 초기 설정 메시지를 보낼 수 없습니다.`,
      error,
    );
  }
}

async function findBotInstallerMember(guild) {
  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.BotAdd,
      limit: 10,
    });
    const lookbackMs = 10 * 60 * 1000;
    const now = Date.now();

    for (const entry of auditLogs.entries.values()) {
      const targetId = entry.targetId ?? entry.target?.id;
      const executorId = entry.executorId ?? entry.executor?.id;
      const isThisBotAdd = targetId === client.user?.id;
      const isRecent = now - entry.createdTimestamp < lookbackMs;

      if (!isThisBotAdd || !isRecent || !executorId) {
        continue;
      }

      try {
        return await guild.members.fetch(executorId);
      } catch {
        return null;
      }
    }
  } catch (error) {
    console.warn(
      `서버 ${guild.id} 감사 로그를 읽지 못해 소유자 대상으로 초기 메시지를 보냅니다.`,
      error,
    );
  }

  return null;
}

async function registerAllGuildCommands() {
  const knownGuilds = await client.guilds.fetch();

  for (const knownGuild of knownGuilds.values()) {
    try {
      const guild = await client.guilds.fetch(knownGuild.id);
      await registerGuildCommands(guild);
    } catch (error) {
      console.error(
        `서버 ${knownGuild.id} 명령어 등록 실패`,
        error,
      );
    }
  }
}

async function registerGuildCommands(guild) {
  await guild.commands.set([
    callRoomCommand.toJSON(),
    ttsCommand.toJSON(),
    ttsTestCommand.toJSON(),
    setupCommand.toJSON(),
    pollCommand.toJSON(),
    queueCommand.toJSON(),
    rolePanelCommand.toJSON(),
    profanityCommand.toJSON(),
  ]);
}

async function handleSetupCommand(interaction) {
  try {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand(false);

    if (!guild) {
      await interaction.reply({
        content: "이 명령어는 서버에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand && subcommand !== SETUP_OPEN_SUBCOMMAND_NAME) {
      await interaction.reply({
        content: "알 수 없는 초기설정 카테고리예요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const hasAdminPermission = await isAdminUser(guild, interaction.user.id);

    if (!hasAdminPermission) {
      await interaction.reply({
        content: "서버 관리자만 초기설정을 변경할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const [loggingConfig, roomConfig, ttsGuildConfig, autoRoleConfig] = await Promise.all([
      getLoggingConfig(guild.id),
      getGuildConfig(guild.id),
      getTtsGuildConfig(guild.id),
      getAutoRoleConfig(guild.id),
    ]);
    const embeds = buildSetupEmbeds(
      loggingConfig,
      roomConfig,
      ttsGuildConfig,
      autoRoleConfig,
    );
    const componentRows = buildSetupPanelComponents(
      guild.id,
      loggingConfig,
      roomConfig,
      ttsGuildConfig,
      autoRoleConfig,
    );

    const sectionCount = Math.min(embeds.length, componentRows.length);

    if (sectionCount === 0) {
      await interaction.reply({
        content: "초기설정 항목을 불러오지 못했어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [embeds[0]],
      components: [componentRows[0]],
      flags: MessageFlags.Ephemeral,
    });

    for (let index = 1; index < sectionCount; index += 1) {
      await interaction.followUp({
        embeds: [embeds[index]],
        components: [componentRows[index]],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error("초기설정 명령어 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "초기설정을 불러오는 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

function buildSetupEmbeds(loggingConfig, roomConfig, ttsGuildConfig, autoRoleConfig) {
  const roomState = roomConfig.enabled ? "켜짐" : "꺼짐";
  const roomChannel = roomConfig.generatorChannelId
    ? `<#${roomConfig.generatorChannelId}>`
    : "미설정";
  const roomCategory = roomConfig.generatorCategoryId
    ? `<#${roomConfig.generatorCategoryId}>`
    : "서버 루트";

  const chatLogState = loggingConfig.chatLogEnabled ? "켜짐" : "꺼짐";
  const chatLogChannel = loggingConfig.chatLogChannelId
    ? `<#${loggingConfig.chatLogChannelId}>`
    : "미설정";

  const joinLeaveState = loggingConfig.joinLeaveLogEnabled ? "켜짐" : "꺼짐";
  const joinLeaveChannel = loggingConfig.joinLeaveLogChannelId
    ? `<#${loggingConfig.joinLeaveLogChannelId}>`
    : "미설정";
  const alertRole = loggingConfig.joinLeaveAlertRoleId
    ? `<@&${loggingConfig.joinLeaveAlertRoleId}>`
    : "없음";

  const ttsMode =
    ttsGuildConfig.inputMode === TTS_GUILD_INPUT_MODE_CHANNEL
      ? "전용 채팅방"
      : ttsGuildConfig.inputMode === TTS_GUILD_INPUT_MODE_GUILD
        ? "자유 모드"
        : "미설정";
  const ttsChannel = ttsGuildConfig.textChannelId
    ? `<#${ttsGuildConfig.textChannelId}>`
    : "미설정";

  const autoRoleState = autoRoleConfig.enabled ? "켜짐" : "꺼짐";
  const autoRoleTarget = autoRoleConfig.joinRoleId
    ? `<@&${autoRoleConfig.joinRoleId}>`
    : "미설정";

  return [
    new EmbedBuilder()
      .setColor(roomConfig.enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle("방생성 기능")
      .addFields(
        { name: "현재 상태", value: roomState, inline: true },
        { name: "생성 채널", value: roomChannel, inline: true },
        { name: "카테고리", value: roomCategory, inline: true },
      ),
    new EmbedBuilder()
      .setColor(loggingConfig.chatLogEnabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle("채팅로그")
      .addFields(
        { name: "현재 상태", value: chatLogState, inline: true },
        { name: "로그 채널", value: chatLogChannel, inline: true },
      ),
    new EmbedBuilder()
      .setColor(loggingConfig.joinLeaveLogEnabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle("들낙로그")
      .addFields(
        { name: "현재 상태", value: joinLeaveState, inline: true },
        { name: "로그 채널", value: joinLeaveChannel, inline: true },
        {
          name: "멘션",
          value: `${loggingConfig.joinLeaveAlertThreshold}회 / ${alertRole}`,
          inline: true,
        },
      ),
    new EmbedBuilder()
      .setColor(ttsGuildConfig.inputMode ? 0x2ecc71 : 0xf39c12)
      .setTitle("TTS")
      .addFields(
        { name: "현재 모드", value: ttsMode, inline: true },
        { name: "전용 채팅방", value: ttsChannel, inline: true },
      ),
    new EmbedBuilder()
      .setColor(autoRoleConfig.enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle("자동 역할")
      .addFields(
        { name: "현재 상태", value: autoRoleState, inline: true },
        { name: "대상 역할", value: autoRoleTarget, inline: true },
      ),
  ];
}

function buildSetupPanelComponents(
  guildId,
  loggingConfig,
  roomConfig,
  ttsGuildConfig,
  autoRoleConfig,
) {
  const roomToggleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SETUP_ROOM_ENABLE_PREFIX}${guildId}`)
      .setLabel("켜기")
      .setStyle(ButtonStyle.Success)
      .setDisabled(roomConfig.enabled),
    new ButtonBuilder()
      .setCustomId(`${SETUP_ROOM_DISABLE_PREFIX}${guildId}`)
      .setLabel("끄기")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!roomConfig.enabled),
    new ButtonBuilder()
      .setCustomId(`${SETUP_ROOM_SETTINGS_BUTTON_PREFIX}${guildId}`)
      .setLabel("설정")
      .setStyle(ButtonStyle.Primary),
  );

  const chatLogRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SETUP_CHAT_LOG_ENABLE_PREFIX}${guildId}`)
      .setLabel("켜기")
      .setStyle(ButtonStyle.Success)
      .setDisabled(loggingConfig.chatLogEnabled),
    new ButtonBuilder()
      .setCustomId(`${SETUP_CHAT_LOG_DISABLE_PREFIX}${guildId}`)
      .setLabel("끄기")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!loggingConfig.chatLogEnabled),
    new ButtonBuilder()
      .setCustomId(`${SETUP_CHAT_LOG_SETTINGS_BUTTON_PREFIX}${guildId}`)
      .setLabel("설정")
      .setStyle(ButtonStyle.Primary),
  );

  const joinLeaveRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SETUP_JOIN_LEAVE_ENABLE_PREFIX}${guildId}`)
      .setLabel("켜기")
      .setStyle(ButtonStyle.Success)
      .setDisabled(loggingConfig.joinLeaveLogEnabled),
    new ButtonBuilder()
      .setCustomId(`${SETUP_JOIN_LEAVE_DISABLE_PREFIX}${guildId}`)
      .setLabel("끄기")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!loggingConfig.joinLeaveLogEnabled),
    new ButtonBuilder()
      .setCustomId(`${SETUP_JOIN_LEAVE_SETTINGS_BUTTON_PREFIX}${guildId}`)
      .setLabel("설정")
      .setStyle(ButtonStyle.Primary),
  );

  const ttsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SETUP_TTS_MODE_CHANNEL_PREFIX}${guildId}`)
      .setLabel("전용")
      .setStyle(ButtonStyle.Success)
      .setDisabled(ttsGuildConfig.inputMode === TTS_GUILD_INPUT_MODE_CHANNEL),
    new ButtonBuilder()
      .setCustomId(`${SETUP_TTS_MODE_GUILD_PREFIX}${guildId}`)
      .setLabel("자유")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(ttsGuildConfig.inputMode === TTS_GUILD_INPUT_MODE_GUILD),
    new ButtonBuilder()
      .setCustomId(`${SETUP_TTS_SETTINGS_BUTTON_PREFIX}${guildId}`)
      .setLabel("설정")
      .setStyle(ButtonStyle.Secondary),
  );

  const autoRoleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SETUP_AUTO_ROLE_ENABLE_PREFIX}${guildId}`)
      .setLabel("켜기")
      .setStyle(ButtonStyle.Success)
      .setDisabled(autoRoleConfig.enabled),
    new ButtonBuilder()
      .setCustomId(`${SETUP_AUTO_ROLE_DISABLE_PREFIX}${guildId}`)
      .setLabel("끄기")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!autoRoleConfig.enabled),
    new ButtonBuilder()
      .setCustomId(`${SETUP_AUTO_ROLE_SETTINGS_BUTTON_PREFIX}${guildId}`)
      .setLabel("설정")
      .setStyle(ButtonStyle.Primary),
  );

  return [roomToggleRow, chatLogRow, joinLeaveRow, ttsRow, autoRoleRow];
}

function buildAutoRoleRoleSelectRow(guildId, autoRoleConfig) {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${SETUP_AUTO_ROLE_ROLE_PREFIX}${guildId}`)
      .setPlaceholder("입장 시 자동 지급할 역할 선택")
      .setDefaultRoles(autoRoleConfig.joinRoleId ? [autoRoleConfig.joinRoleId] : [])
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function buildRoomCategorySelectRow(guildId, roomConfig) {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`${SETUP_ROOM_CATEGORY_PREFIX}${guildId}`)
      .setPlaceholder("방생성 카테고리 선택")
      .setDefaultChannels(
        roomConfig.generatorCategoryId ? [roomConfig.generatorCategoryId] : [],
      )
      .setChannelTypes(ChannelType.GuildCategory)
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function buildChatLogChannelSelectRow(guildId, loggingConfig) {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`${SETUP_CHAT_LOG_CHANNEL_PREFIX}${guildId}`)
      .setPlaceholder("채팅로그 채널 선택")
      .setDefaultChannels(
        loggingConfig.chatLogChannelId ? [loggingConfig.chatLogChannelId] : [],
      )
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function buildJoinLeaveChannelSelectRow(guildId, loggingConfig) {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`${SETUP_JOIN_LEAVE_CHANNEL_PREFIX}${guildId}`)
      .setPlaceholder("들낙로그 채널 선택")
      .setDefaultChannels(
        loggingConfig.joinLeaveLogChannelId
          ? [loggingConfig.joinLeaveLogChannelId]
          : [],
      )
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function buildTtsChannelSelectRow(guildId, ttsGuildConfig) {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`${SETUP_TTS_CHANNEL_PREFIX}${guildId}`)
      .setPlaceholder("TTS 전용 채팅방 선택")
      .setDefaultChannels(
        ttsGuildConfig.textChannelId ? [ttsGuildConfig.textChannelId] : [],
      )
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  );
}

async function handleSetupButtonInteraction(interaction) {
  const guildId = interaction.customId.split(":").at(-1);

  if (!interaction.guild || interaction.guild.id !== guildId) {
    await interaction.reply({
      content: "잘못된 서버 설정 요청이에요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const hasAdminPermission = await isAdminUser(
    interaction.guild,
    interaction.user.id,
  );

  if (!hasAdminPermission) {
    await interaction.reply({
      content: "서버 관리자만 초기설정을 변경할 수 있어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_ROOM_SETTINGS_BUTTON_PREFIX)) {
    const currentRoomConfig = await getGuildConfig(interaction.guild.id);

    await interaction.reply({
      content: "방생성 설정",
      components: [buildRoomCategorySelectRow(interaction.guild.id, currentRoomConfig)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_CHAT_LOG_SETTINGS_BUTTON_PREFIX)) {
    const currentLoggingConfig = await getLoggingConfig(interaction.guild.id);
    const bootstrapRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_LOGS_BOOTSTRAP_PREFIX}${interaction.guild.id}`)
        .setLabel("로그 자동 생성")
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({
      content: "채팅로그 설정",
      components: [
        buildChatLogChannelSelectRow(interaction.guild.id, currentLoggingConfig),
        bootstrapRow,
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_JOIN_LEAVE_SETTINGS_BUTTON_PREFIX)) {
    const currentLoggingConfig = await getLoggingConfig(interaction.guild.id);
    const alertRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_JOIN_LEAVE_ALERT_BUTTON_PREFIX}${interaction.guild.id}`)
        .setLabel("멘션 설정")
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({
      content: "들낙로그 설정",
      components: [
        buildJoinLeaveChannelSelectRow(interaction.guild.id, currentLoggingConfig),
        alertRow,
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_TTS_SETTINGS_BUTTON_PREFIX)) {
    const currentTtsGuildConfig = await getTtsGuildConfig(interaction.guild.id);

    await interaction.reply({
      content: "TTS 설정",
      components: [buildTtsChannelSelectRow(interaction.guild.id, currentTtsGuildConfig)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_AUTO_ROLE_SETTINGS_BUTTON_PREFIX)) {
    const currentAutoRoleConfig = await getAutoRoleConfig(interaction.guild.id);

    await interaction.reply({
      content: "자동 역할 설정",
      components: [
        buildAutoRoleRoleSelectRow(interaction.guild.id, currentAutoRoleConfig),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_LOGS_BOOTSTRAP_PREFIX)) {
    const current = await getLoggingConfig(interaction.guild.id);
    const preset = await ensureLogCategoryAndChannels(interaction.guild, current);

    await updateLoggingConfig(interaction.guild.id, {
      chatLogEnabled: true,
      chatLogChannelId: preset.chatLogChannel.id,
      joinLeaveLogEnabled: true,
      joinLeaveLogChannelId: preset.joinLeaveLogChannel.id,
    });

    await interaction.reply({
      content:
        `완료! <#${preset.category.id}> 카테고리에 ` +
        `<#${preset.chatLogChannel.id}> / <#${preset.joinLeaveLogChannel.id}> 채널을 준비했어요.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_ROOM_ENABLE_PREFIX)) {
    const roomConfig = await getGuildConfig(interaction.guild.id);
    const roomGeneratorChannel = await ensureRoomGeneratorChannel(
      interaction.guild,
      roomConfig.generatorCategoryId,
    );

    await enableRoomGenerator(
      interaction.guild.id,
      roomGeneratorChannel.id,
      roomGeneratorChannel.parentId ?? null,
    );

    await interaction.reply({
      content: `방생성을 켰어요. 생성 채널: <#${roomGeneratorChannel.id}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_ROOM_DISABLE_PREFIX)) {
    await disableRoomGenerator(interaction.guild.id);

    await interaction.reply({
      content: "방생성을 껐어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_AUTO_ROLE_ENABLE_PREFIX)) {
    const currentAutoRoleConfig = await getAutoRoleConfig(interaction.guild.id);

    if (!currentAutoRoleConfig.joinRoleId) {
      await interaction.reply({
        content: "먼저 설정에서 자동 지급할 역할을 선택해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const role =
      interaction.guild.roles.cache.get(currentAutoRoleConfig.joinRoleId) ??
      (await interaction.guild.roles
        .fetch(currentAutoRoleConfig.joinRoleId)
        .catch(() => null));

    if (!role || role.id === interaction.guild.id) {
      await interaction.reply({
        content: "설정된 역할을 찾을 수 없어요. 다시 선택해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateAutoRoleConfig(interaction.guild.id, {
      enabled: true,
      joinRoleId: role.id,
    });

    await interaction.reply({
      content: `자동 역할을 켰어요. 대상 역할: <@&${role.id}>`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: {
        roles: [role.id],
      },
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_AUTO_ROLE_DISABLE_PREFIX)) {
    await updateAutoRoleConfig(interaction.guild.id, {
      enabled: false,
    });

    await interaction.reply({
      content: "자동 역할을 껐어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_CHAT_LOG_ENABLE_PREFIX)) {
    const current = await getLoggingConfig(interaction.guild.id);
    const logChannel = await ensureTextChannel(
      interaction.guild,
      current.chatLogChannelId,
      DEFAULT_CHAT_LOG_CHANNEL_NAME,
    );

    await updateLoggingConfig(interaction.guild.id, {
      chatLogEnabled: true,
      chatLogChannelId: logChannel.id,
    });

    await interaction.reply({
      content: `채팅로그를 켰어요. 로그 채널: <#${logChannel.id}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_CHAT_LOG_DISABLE_PREFIX)) {
    await updateLoggingConfig(interaction.guild.id, {
      chatLogEnabled: false,
    });

    await interaction.reply({
      content: "채팅로그를 껐어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_JOIN_LEAVE_ENABLE_PREFIX)) {
    const current = await getLoggingConfig(interaction.guild.id);
    const logChannel = await ensureTextChannel(
      interaction.guild,
      current.joinLeaveLogChannelId,
      DEFAULT_JOIN_LEAVE_LOG_CHANNEL_NAME,
    );

    await updateLoggingConfig(interaction.guild.id, {
      joinLeaveLogEnabled: true,
      joinLeaveLogChannelId: logChannel.id,
    });

    await interaction.reply({
      content: `들낙로그를 켰어요. 로그 채널: <#${logChannel.id}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_JOIN_LEAVE_DISABLE_PREFIX)) {
    await updateLoggingConfig(interaction.guild.id, {
      joinLeaveLogEnabled: false,
    });

    await interaction.reply({
      content: "들낙로그를 껐어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_JOIN_LEAVE_ALERT_BUTTON_PREFIX)) {
    const current = await getLoggingConfig(interaction.guild.id);

    const modal = new ModalBuilder()
      .setCustomId(`${SETUP_JOIN_LEAVE_ALERT_MODAL_PREFIX}${interaction.guild.id}`)
      .setTitle("들낙 멘션 설정");

    const thresholdInput = new TextInputBuilder()
      .setCustomId("threshold")
      .setLabel("몇 회 이상 멘션할까요? (0이면 비활성)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("예: 3")
      .setValue(String(current.joinLeaveAlertThreshold));

    const roleInput = new TextInputBuilder()
      .setCustomId("role")
      .setLabel("멘션할 역할(멘션 또는 역할 ID, 비우면 해제)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder("예: <@&1234567890>")
      .setValue(current.joinLeaveAlertRoleId ?? "");

    modal.addComponents(
      new ActionRowBuilder().addComponents(thresholdInput),
      new ActionRowBuilder().addComponents(roleInput),
    );

    await interaction.showModal(modal);
  }
}

async function handleSetupTtsButtonInteraction(interaction) {
  const guildId = interaction.customId.split(":").at(-1);

  if (!interaction.guild || interaction.guild.id !== guildId) {
    await safeInteractionReply(interaction, {
      content: "잘못된 TTS 설정 요청이에요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const hasAdminPermission = await isAdminUser(
    interaction.guild,
    interaction.user.id,
  );

  if (!hasAdminPermission) {
    await safeInteractionReply(interaction, {
      content: "서버 관리자만 TTS 입력 방식을 변경할 수 있어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId.startsWith(SETUP_TTS_MODE_CHANNEL_PREFIX)) {
    const current = await getTtsGuildConfig(interaction.guild.id);
    const ttsChannel = await ensureTtsInputTextChannel(
      interaction.guild,
      current.textChannelId,
    );

    await updateTtsGuildConfig(interaction.guild.id, {
      inputMode: TTS_GUILD_INPUT_MODE_CHANNEL,
      textChannelId: ttsChannel.id,
    });

    await safeInteractionReply(interaction, {
      content:
        `전용 채팅방 모드로 설정했어요. ` +
        `이제 <#${ttsChannel.id}> 메시지만 TTS로 읽어요.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await updateTtsGuildConfig(interaction.guild.id, {
    inputMode: TTS_GUILD_INPUT_MODE_GUILD,
    textChannelId: null,
  });

  await safeInteractionReply(interaction, {
    content: "자유 모드로 설정했어요. 이제 서버 채팅방 어디서든 TTS로 읽어요.",
    flags: MessageFlags.Ephemeral,
  });
}

async function handleSetupRoleSelectInteraction(interaction) {
  const customId = interaction.customId;

  if (!customId.startsWith(SETUP_AUTO_ROLE_ROLE_PREFIX)) {
    return;
  }

  const guildId = customId.split(":").at(-1);

  if (!interaction.guild || interaction.guild.id !== guildId) {
    await interaction.reply({
      content: "잘못된 서버 설정 요청이에요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const hasAdminPermission = await isAdminUser(
    interaction.guild,
    interaction.user.id,
  );

  if (!hasAdminPermission) {
    await interaction.reply({
      content: "서버 관리자만 초기설정을 변경할 수 있어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedRoleId = interaction.values[0];

  if (selectedRoleId === interaction.guild.id) {
    await interaction.reply({
      content: "@everyone 역할은 자동 지급 대상으로 설정할 수 없어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await updateAutoRoleConfig(interaction.guild.id, {
    joinRoleId: selectedRoleId,
  });

  await interaction.reply({
    content: `자동 역할을 <@&${selectedRoleId}> 로 설정했어요.`,
    flags: MessageFlags.Ephemeral,
    allowedMentions: {
      roles: [selectedRoleId],
    },
  });
}

async function handleSetupChannelSelectInteraction(interaction) {
  const customId = interaction.customId;

  if (
    !customId.startsWith(SETUP_ROOM_CATEGORY_PREFIX) &&
    !customId.startsWith(SETUP_CHAT_LOG_CHANNEL_PREFIX) &&
    !customId.startsWith(SETUP_JOIN_LEAVE_CHANNEL_PREFIX) &&
    !customId.startsWith(SETUP_TTS_CHANNEL_PREFIX)
  ) {
    return;
  }

  const guildId = customId.split(":").at(-1);

  if (!interaction.guild || interaction.guild.id !== guildId) {
    await interaction.reply({
      content: "잘못된 서버 설정 요청이에요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const hasAdminPermission = await isAdminUser(
    interaction.guild,
    interaction.user.id,
  );

  if (!hasAdminPermission) {
    await interaction.reply({
      content: "서버 관리자만 초기설정을 변경할 수 있어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedChannelId = interaction.values[0];

  if (customId.startsWith(SETUP_ROOM_CATEGORY_PREFIX)) {
    const roomGeneratorChannel = await ensureRoomGeneratorChannel(
      interaction.guild,
      selectedChannelId,
    );

    await enableRoomGenerator(
      interaction.guild.id,
      roomGeneratorChannel.id,
      roomGeneratorChannel.parentId ?? null,
    );

    await interaction.reply({
      content: `방생성 카테고리를 <#${selectedChannelId}> 로 설정했어요.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (customId.startsWith(SETUP_CHAT_LOG_CHANNEL_PREFIX)) {
    await updateLoggingConfig(interaction.guild.id, {
      chatLogEnabled: true,
      chatLogChannelId: selectedChannelId,
    });

    await interaction.reply({
      content: `채팅로그 채널을 <#${selectedChannelId}> 로 설정했어요.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (customId.startsWith(SETUP_TTS_CHANNEL_PREFIX)) {
    await updateTtsGuildConfig(interaction.guild.id, {
      inputMode: TTS_GUILD_INPUT_MODE_CHANNEL,
      textChannelId: selectedChannelId,
    });

    await interaction.reply({
      content: `TTS 전용 채팅방을 <#${selectedChannelId}> 로 설정했어요.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await updateLoggingConfig(interaction.guild.id, {
    joinLeaveLogEnabled: true,
    joinLeaveLogChannelId: selectedChannelId,
  });

  await interaction.reply({
    content: `들낙로그 채널을 <#${selectedChannelId}> 로 설정했어요.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleJoinLeaveAlertModalSubmit(interaction) {
  const guildId = interaction.customId.split(":").at(-1);

  if (!interaction.guild || interaction.guild.id !== guildId) {
    await interaction.reply({
      content: "잘못된 서버 설정 요청이에요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const hasAdminPermission = await isAdminUser(
    interaction.guild,
    interaction.user.id,
  );

  if (!hasAdminPermission) {
    await interaction.reply({
      content: "서버 관리자만 초기설정을 변경할 수 있어요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const thresholdRaw = interaction.fields.getTextInputValue("threshold").trim();
  const roleRaw = interaction.fields.getTextInputValue("role").trim();

  if (!/^\d+$/.test(thresholdRaw)) {
    await interaction.reply({
      content: "횟수는 0 이상의 정수로 입력해 주세요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const threshold = Number.parseInt(thresholdRaw, 10);

  if (threshold < 0 || threshold > 100) {
    await interaction.reply({
      content: "횟수는 0에서 100 사이로 입력해 주세요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let roleId = null;

  if (roleRaw) {
    const mentionMatch = /^<@&(\d+)>$/.exec(roleRaw);
    const idMatch = /^(\d+)$/.exec(roleRaw);

    roleId = mentionMatch?.[1] ?? idMatch?.[1] ?? null;

    if (!roleId || !interaction.guild.roles.cache.has(roleId)) {
      await interaction.reply({
        content: "역할 입력은 역할 멘션 또는 역할 ID로 입력해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  await updateLoggingConfig(interaction.guild.id, {
    joinLeaveAlertThreshold: threshold,
    joinLeaveAlertRoleId: roleId,
  });

  const roleSummary = roleId ? `<@&${roleId}>` : "없음";

  await interaction.reply({
    content: `들낙 멘션 설정 완료: ${threshold}회 이상일 때 ${roleSummary}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function isAdminUser(guild, userId) {
  const member = await guild.members.fetch(userId);
  return (
    guild.ownerId === userId ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

async function ensureTextChannel(guild, preferredChannelId, defaultName) {
  const preferred = preferredChannelId
    ? guild.channels.cache.get(preferredChannelId)
    : null;

  if (preferred?.type === ChannelType.GuildText) {
    return preferred;
  }

  const foundByName = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText && channel.name === defaultName,
  );

  if (foundByName) {
    return foundByName;
  }

  return guild.channels.create({
    name: defaultName,
    type: ChannelType.GuildText,
  });
}

async function ensureLogCategoryAndChannels(guild, loggingConfig) {
  const category = await ensureCategoryChannel(guild, DEFAULT_LOG_CATEGORY_NAME);

  const chatLogChannel = await ensureTextChannelInCategory(
    guild,
    loggingConfig.chatLogChannelId,
    DEFAULT_CHAT_LOG_CHANNEL_PRESET_NAME,
    category.id,
    LEGACY_CHAT_LOG_CHANNEL_NAMES,
  );

  const joinLeaveLogChannel = await ensureTextChannelInCategory(
    guild,
    loggingConfig.joinLeaveLogChannelId,
    DEFAULT_JOIN_LEAVE_LOG_CHANNEL_PRESET_NAME,
    category.id,
    LEGACY_JOIN_LEAVE_LOG_CHANNEL_NAMES,
  );

  return {
    category,
    chatLogChannel,
    joinLeaveLogChannel,
  };
}

async function ensureCategoryChannel(guild, categoryName) {
  const foundByName = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildCategory && channel.name === categoryName,
  );

  if (foundByName) {
    return foundByName;
  }

  return guild.channels.create({
    name: categoryName,
    type: ChannelType.GuildCategory,
  });
}

async function ensureTextChannelInCategory(
  guild,
  preferredChannelId,
  defaultName,
  categoryId,
  fallbackNames = [],
) {
  let preferred = null;

  if (preferredChannelId) {
    preferred =
      guild.channels.cache.get(preferredChannelId) ??
      (await guild.channels.fetch(preferredChannelId).catch(() => null));
  }

  if (preferred?.type === ChannelType.GuildText) {
    if (preferred.parentId !== categoryId) {
      await preferred.setParent(categoryId);
    }

    return preferred;
  }

  const acceptedNames = new Set([defaultName, ...fallbackNames]);

  const foundByName = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText && acceptedNames.has(channel.name),
  );

  if (foundByName) {
    if (foundByName.parentId !== categoryId) {
      await foundByName.setParent(categoryId);
    }

    return foundByName;
  }

  return guild.channels.create({
    name: defaultName,
    type: ChannelType.GuildText,
    parent: categoryId,
  });
}

async function handleMessageDeleteLog(message) {
  let workingMessage = message;

  if (!workingMessage.guild) {
    return;
  }

  if (workingMessage.partial) {
    try {
      workingMessage = await workingMessage.fetch();
    } catch {
      // keep partial state when fetch fails
    }
  }

  const config = await getLoggingConfig(workingMessage.guild.id);

  if (!config.chatLogEnabled || !config.chatLogChannelId) {
    return;
  }

  const logChannel = await getTextChannelForLog(
    workingMessage.guild,
    config.chatLogChannelId,
  );

  if (!logChannel?.isTextBased()) {
    return;
  }

  if (workingMessage.channelId === config.chatLogChannelId) {
    return;
  }

  const author = workingMessage.author;

  if (author?.bot) {
    return;
  }

  const content = sanitizeForTts(workingMessage.content) || "(내용 없음)";
  const attachments = [...(workingMessage.attachments?.values() ?? [])]
    .map((attachment) => attachment.url)
    .slice(0, 5)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("채팅 삭제 감지")
    .addFields(
      {
        name: "채널",
        value: `<#${workingMessage.channelId}>`,
        inline: true,
      },
      {
        name: "작성자",
        value: author ? `<@${author.id}> (${author.id})` : "알 수 없음",
        inline: true,
      },
      {
        name: "삭제된 메시지",
        value: content.slice(0, 1024),
        inline: false,
      },
    )
    .setTimestamp();

  if (attachments) {
    embed.addFields({
      name: "첨부파일",
      value: attachments.slice(0, 1024),
      inline: false,
    });
  }

  await logChannel.send({ embeds: [embed] });
}

async function handleVoiceJoinLeaveLog(oldState, newState) {
  if (oldState.channelId === newState.channelId) {
    return;
  }

  const member = newState.member ?? oldState.member;

  if (!member || member.user?.bot) {
    return;
  }

  const guild = newState.guild ?? oldState.guild;
  const config = await getLoggingConfig(guild.id);

  if (!config.joinLeaveLogEnabled || !config.joinLeaveLogChannelId) {
    return;
  }

  const logChannel = await getTextChannelForLog(
    guild,
    config.joinLeaveLogChannelId,
  );

  if (!logChannel?.isTextBased()) {
    return;
  }

  const eventCount = recordJoinLeaveEvent(guild.id, member.id);
  const timeText = formatLogTime(new Date());

  const userName = member.displayName ?? member.user.username;
  const oldChannelName = oldState.channel?.name;
  const newChannelName = newState.channel?.name;

  let title = null;
  let color = 0x95a5a6;
  let actionText = null;

  if (!oldState.channelId && newState.channelId && newChannelName) {
    title = "Voice Joined";
    color = 0x2ecc71;
    actionText = `${userName}님이 ${newChannelName} 채널에 입장했습니다.`;
  } else if (oldState.channelId && !newState.channelId && oldChannelName) {
    title = "Voice Left";
    color = 0xe74c3c;
    actionText = `${userName}님이 ${oldChannelName} 채널에서 퇴장했습니다.`;
  } else if (oldChannelName && newChannelName) {
    title = "Voice Moved";
    color = 0x3498db;
    actionText = `${userName}님이 ${oldChannelName} 채널에서 ${newChannelName} 채널로 이동했습니다.`;
  }

  if (!actionText) {
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(actionText)
    .setThumbnail(member.displayAvatarURL())
    .addFields(
      {
        name: "사용자",
        value: `<@${member.id}> (${member.user.tag})`,
        inline: true,
      },
      {
        name: "최근 들낙 횟수",
        value: `${eventCount}회 (최근 10분)`,
        inline: true,
      },
      {
        name: "시간",
        value: timeText,
        inline: true,
      },
    )
    .setTimestamp();

  const shouldMentionRole =
    config.joinLeaveAlertThreshold > 0 &&
    eventCount >= config.joinLeaveAlertThreshold &&
    Boolean(config.joinLeaveAlertRoleId);

  if (shouldMentionRole) {
    await logChannel.send({
      content: `<@&${config.joinLeaveAlertRoleId}> 들낙 반복 감지`,
      embeds: [embed],
      allowedMentions: {
        roles: [config.joinLeaveAlertRoleId],
      },
    });
    return;
  }

  await logChannel.send({ embeds: [embed] });
}

function formatLogTime(date) {
  return date
    .toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      hourCycle: "h23",
    })
    .replace(/^24:/, "00:");
}

async function getTextChannelForLog(guild, channelId) {
  if (!channelId) {
    return null;
  }

  const cached = guild.channels.cache.get(channelId);

  if (cached) {
    return cached;
  }

  try {
    return await guild.channels.fetch(channelId);
  } catch {
    return null;
  }
}

function recordJoinLeaveEvent(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const previous = joinLeaveEventHistory.get(key) ?? [];
  const filtered = previous.filter((timestamp) => now - timestamp <= JOIN_LEAVE_WINDOW_MS);

  filtered.push(now);
  joinLeaveEventHistory.set(key, filtered);

  return filtered.length;
}

function formatDuration(ms) {
  if (ms <= 0) {
    return "0s";
  }

  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (remainSeconds > 0 && parts.length < 2) {
    parts.push(`${remainSeconds}s`);
  }

  return parts.join(", ");
}

async function handlePollCommand(interaction) {
  try {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand(false);

    if (!guild) {
      await interaction.reply({
        content: "이 명령어는 서버에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand && subcommand !== POLL_CREATE_SUBCOMMAND_NAME) {
      await interaction.reply({
        content: "알 수 없는 투표 카테고리예요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetChannel = interaction.options.getChannel("채널", true);

    if (!isPollTextChannel(targetChannel)) {
      await interaction.reply({
        content: "투표 채널은 일반 텍스트 채널 또는 공지 채널만 선택할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const visibility =
      interaction.options.getString("유형") ?? POLL_VISIBILITY_ANONYMOUS;

    const modal = new ModalBuilder()
      .setCustomId(
        `${POLL_CREATE_MODAL_PREFIX}${guild.id}:${targetChannel.id}:${visibility}:${interaction.user.id}`,
      )
      .setTitle("투표 생성하기");

    const subjectInput = new TextInputBuilder()
      .setCustomId(POLL_SUBJECT_FIELD_ID)
      .setLabel("주제")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("최고의 분식은?")
      .setMinLength(1)
      .setMaxLength(100);

    const optionsInput = new TextInputBuilder()
      .setCustomId(POLL_OPTIONS_FIELD_ID)
      .setLabel("선택지 (엔터로 구분, 최대 10개)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder("오뎅\n떡볶이\n순대")
      .setMinLength(3)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(subjectInput),
      new ActionRowBuilder().addComponents(optionsInput),
    );

    await interaction.showModal(modal);
  } catch (error) {
    console.error("투표 명령어 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "투표 생성 화면을 여는 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handlePollCreateModalSubmit(interaction) {
  try {
    const parsed = parsePollCreateModalCustomId(interaction.customId);

    if (!parsed || !interaction.guild || interaction.guild.id !== parsed.guildId) {
      await safeInteractionReply(interaction, {
        content: "유효하지 않은 투표 생성 요청이에요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.user.id !== parsed.creatorUserId) {
      await safeInteractionReply(interaction, {
        content: "이 투표 생성 창은 명령어를 입력한 사용자만 제출할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const didDefer = await safeDeferEphemeral(interaction);

    if (!didDefer) {
      return;
    }

    const targetChannel =
      interaction.guild.channels.cache.get(parsed.channelId) ??
      (await interaction.guild.channels.fetch(parsed.channelId).catch(() => null));

    if (!isPollTextChannel(targetChannel)) {
      await safeInteractionEditReply(interaction, {
        content: "선택한 투표 채널을 찾을 수 없어요.",
      });
      return;
    }

    const me = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
    const canSend = targetChannel.permissionsFor(me)?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);

    if (!canSend) {
      await safeInteractionEditReply(interaction, {
        content: "해당 채널에 메시지를 보낼 권한이 없어요. 봇 권한을 확인해 주세요.",
      });
      return;
    }

    const topic = interaction.fields.getTextInputValue(POLL_SUBJECT_FIELD_ID).trim();
    const rawOptions = interaction.fields.getTextInputValue(POLL_OPTIONS_FIELD_ID);
    const { options, error } = parsePollOptionsInput(rawOptions);

    if (!topic) {
      await safeInteractionEditReply(interaction, {
        content: "주제를 입력해 주세요.",
      });
      return;
    }

    if (error) {
      await safeInteractionEditReply(interaction, {
        content: error,
      });
      return;
    }

    const pollRecord = {
      pollId: createPollId(),
      guildId: interaction.guild.id,
      channelId: targetChannel.id,
      messageId: null,
      creatorUserId: interaction.user.id,
      topic: topic.slice(0, 100),
      options,
      isAnonymous: parsed.visibility === POLL_VISIBILITY_ANONYMOUS,
      status: "open",
      votesByUser: {},
      closedByUserId: null,
      createdAtMs: Date.now(),
      closedAtMs: null,
    };

    const payload = buildPollMessagePayload(pollRecord);
    const pollMessage = await targetChannel.send(payload);

    await createPollRecord({
      ...pollRecord,
      messageId: pollMessage.id,
    });

    await safeInteractionDeleteReply(interaction);
  } catch (error) {
    console.error("투표 생성 제출 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "투표를 만드는 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.deferred) {
      await safeInteractionEditReply(interaction, {
        content: "투표를 만드는 중 오류가 발생했어요.",
      });
    }
  }
}

async function refreshPollMessage(interaction, poll) {
  const payload = buildPollMessagePayload(poll);

  if (interaction.message?.id === poll.messageId) {
    await interaction.message.edit(payload);
    return;
  }

  if (!interaction.guild) {
    return;
  }

  const targetChannel =
    interaction.guild.channels.cache.get(poll.channelId) ??
    (await interaction.guild.channels.fetch(poll.channelId).catch(() => null));

  if (!targetChannel?.isTextBased() || !("messages" in targetChannel)) {
    return;
  }

  const targetMessage = await targetChannel.messages.fetch(poll.messageId).catch(() => null);

  if (!targetMessage) {
    return;
  }

  await targetMessage.edit(payload);
}

async function handlePollButtonInteraction(interaction) {
  try {
    const [, , action, pollId, optionIndexRaw] = interaction.customId.split(":");

    if (!interaction.guild || !action || !pollId) {
      await safeInteractionReply(interaction, {
        content: "유효하지 않은 투표 버튼이에요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const didDefer = await safeDeferEphemeral(interaction);

    if (!didDefer) {
      return;
    }

    const poll = await getPollRecord(pollId);

    if (!poll || poll.guildId !== interaction.guild.id) {
      await safeInteractionEditReply(interaction, {
        content: "투표 정보를 찾을 수 없어요.",
      });
      return;
    }

    if (action === "status") {
      await safeInteractionEditReply(interaction, {
        content: "투표 현황 기능은 제거되었어요. 투표 결과 버튼을 사용해 주세요.",
      });
      return;
    }

    if (action === "result") {
      if (poll.status !== "closed") {
        await safeInteractionEditReply(interaction, {
          content: "아직 투표가 진행 중이에요. 투표 종료 후 결과를 확인해 주세요.",
        });
        return;
      }

      await safeInteractionEditReply(interaction, {
        embeds: [buildPollStatusEmbed(poll, `${poll.topic} - 투표 결과`)],
      });
      return;
    }

    if (action === "vote") {
      if (poll.status !== "open") {
        await safeInteractionEditReply(interaction, {
          content: "이미 종료된 투표예요.",
        });
        return;
      }

      const optionIndex = Number.parseInt(optionIndexRaw, 10);

      if (
        !Number.isInteger(optionIndex) ||
        optionIndex < 0 ||
        optionIndex >= poll.options.length
      ) {
        await safeInteractionEditReply(interaction, {
          content: "유효하지 않은 선택지예요.",
        });
        return;
      }

      const previousOption = poll.votesByUser[interaction.user.id];
      poll.votesByUser[interaction.user.id] = optionIndex;

      const savedPoll = await savePollRecord(poll);
      await refreshPollMessage(interaction, savedPoll);

      if (previousOption === optionIndex) {
        await safeInteractionDeleteReply(interaction);
        return;
      }

      await safeInteractionDeleteReply(interaction);
      return;
    }

    if (action === "end") {
      const canClosePoll =
        interaction.user.id === poll.creatorUserId ||
        (await isAdminUser(interaction.guild, interaction.user.id));

      if (!canClosePoll) {
        await safeInteractionEditReply(interaction, {
          content: "투표 종료는 관리자 또는 투표 생성자만 가능해요.",
        });
        return;
      }

      if (poll.status === "closed") {
        await safeInteractionEditReply(interaction, {
          content: "이미 종료된 투표예요.",
        });
        return;
      }

      const closedPoll = await savePollRecord({
        ...poll,
        status: "closed",
        closedByUserId: interaction.user.id,
        closedAtMs: Date.now(),
      });

      await refreshPollMessage(interaction, closedPoll);

      await safeInteractionDeleteReply(interaction);
      return;
    }

    await safeInteractionEditReply(interaction, {
      content: "알 수 없는 투표 버튼 동작이에요.",
    });
  } catch (error) {
    console.error("투표 버튼 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "투표 버튼 처리 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.deferred) {
      await safeInteractionEditReply(interaction, {
        content: "투표 버튼 처리 중 오류가 발생했어요.",
      });
    }
  }
}

async function handleQueueCommand(interaction) {
  try {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== QUEUE_CREATE_SUBCOMMAND_NAME) {
      await safeInteractionReply(interaction, {
        content: "알 수 없는 선착순 명령어예요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!guild || !interaction.channel) {
      await safeInteractionReply(interaction, {
        content: "이 명령어는 서버 텍스트 채널에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!isQueueTextChannel(interaction.channel)) {
      await safeInteractionReply(interaction, {
        content: "선착순은 일반 텍스트 채널 또는 공지 채널에서만 생성할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const mentionRole = interaction.options.getRole("멘션역할");

    if (mentionRole && mentionRole.id === guild.id) {
      await safeInteractionReply(interaction, {
        content: "@everyone 역할은 선착순 멘션 역할로 선택할 수 없어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const mentionRoleId = mentionRole?.id ?? "none";

    const modal = new ModalBuilder()
      .setCustomId(
        `${QUEUE_CREATE_MODAL_PREFIX}${guild.id}:${interaction.channel.id}:${interaction.user.id}:${mentionRoleId}`,
      )
      .setTitle("선착순 만들기");

    const titleInput = new TextInputBuilder()
      .setCustomId(QUEUE_TITLE_FIELD_ID)
      .setLabel("모집 제목")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("예: 발로란트 10인 내전")
      .setMinLength(1)
      .setMaxLength(100);

    const limitInput = new TextInputBuilder()
      .setCustomId(QUEUE_LIMIT_FIELD_ID)
      .setLabel("모집 인원 (2~101)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("예: 10")
      .setMinLength(1)
      .setMaxLength(3);

    const timeoutInput = new TextInputBuilder()
      .setCustomId(QUEUE_TIMEOUT_FIELD_ID)
      .setLabel("시간 제한(분) (1~720)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("예: 30")
      .setValue("30")
      .setMinLength(1)
      .setMaxLength(3);

    const noteInput = new TextInputBuilder()
      .setCustomId(QUEUE_NOTE_FIELD_ID)
      .setLabel("안내 문구 (선택)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setPlaceholder("예: 10분 안에 모여주세요")
      .setMaxLength(300);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(limitInput),
      new ActionRowBuilder().addComponents(timeoutInput),
      new ActionRowBuilder().addComponents(noteInput),
    );

    await interaction.showModal(modal);
  } catch (error) {
    console.error("선착 명령어 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "선착순 생성 화면을 여는 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleQueueStatusCommand(interaction) {
  try {
    if (!interaction.guild) {
      await safeInteractionReply(interaction, {
        content: "이 명령어는 서버에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const openQueue = await getOpenQueueByGuildId(interaction.guild.id);
    const queue = await closeQueueIfExpired(openQueue);

    if (!queue || queue.status !== "open") {
      await safeInteractionReply(interaction, {
        content: "현재 진행 중인 선착순이 없어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await safeInteractionReply(interaction, {
      embeds: [buildQueueStatusEmbed(queue, `${queue.title} - 선착순 현황`)],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("선착현황 명령어 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "선착순 현황을 불러오는 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleQueueCreateModalSubmit(interaction) {
  try {
    const parsed = parseQueueCreateModalCustomId(interaction.customId);

    if (!parsed || !interaction.guild || interaction.guild.id !== parsed.guildId) {
      await safeInteractionReply(interaction, {
        content: "유효하지 않은 선착순 생성 요청이에요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.user.id !== parsed.creatorUserId) {
      await safeInteractionReply(interaction, {
        content: "이 선착순 생성 창은 명령어를 입력한 사용자만 제출할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const didDefer = await safeDeferEphemeral(interaction);

    if (!didDefer) {
      return;
    }

    const targetChannel =
      interaction.guild.channels.cache.get(parsed.channelId) ??
      (await interaction.guild.channels.fetch(parsed.channelId).catch(() => null));

    if (!isQueueTextChannel(targetChannel)) {
      await safeInteractionEditReply(interaction, {
        content: "선착순을 올릴 채널을 찾을 수 없어요.",
      });
      return;
    }

    const me = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
    const canSend = targetChannel.permissionsFor(me)?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);

    if (!canSend) {
      await safeInteractionEditReply(interaction, {
        content: "해당 채널에 메시지를 보낼 권한이 없어요. 봇 권한을 확인해 주세요.",
      });
      return;
    }

    const existingQueue = await getOpenQueueByGuildId(interaction.guild.id);

    if (existingQueue) {
      const existingChannel =
        interaction.guild.channels.cache.get(existingQueue.channelId) ??
        (await interaction.guild.channels.fetch(existingQueue.channelId).catch(() => null));

      const existingMessage =
        existingChannel?.isTextBased() && "messages" in existingChannel
          ? await existingChannel.messages
              .fetch(existingQueue.messageId)
              .catch(() => null)
          : null;

      if (existingMessage) {
        await safeInteractionEditReply(interaction, {
          content:
            "이미 진행 중인 선착순이 있어요. 기존 모집을 마감한 뒤 새로 만들어 주세요.",
        });
        return;
      }

      await saveQueueRecord({
        ...existingQueue,
        status: "closed",
        closedByUserId: interaction.user.id,
        closedAtMs: Date.now(),
      });

      clearQueueTimeout(existingQueue.queueId);
    }

    const title = interaction.fields.getTextInputValue(QUEUE_TITLE_FIELD_ID).trim();
    const rawLimit = interaction.fields.getTextInputValue(QUEUE_LIMIT_FIELD_ID);
    const rawTimeout = interaction.fields.getTextInputValue(QUEUE_TIMEOUT_FIELD_ID);
    const note = interaction.fields.getTextInputValue(QUEUE_NOTE_FIELD_ID).trim();
    const { limit, error } = parseQueueLimitInput(rawLimit);
    const { timeoutMinutes, error: timeoutError } = parseQueueTimeoutInput(rawTimeout);

    let mentionRoleId = parsed.mentionRoleId;

    if (mentionRoleId) {
      const mentionRole =
        interaction.guild.roles.cache.get(mentionRoleId) ??
        (await interaction.guild.roles.fetch(mentionRoleId).catch(() => null));

      if (!mentionRole || mentionRole.id === interaction.guild.id) {
        await safeInteractionEditReply(interaction, {
          content: "선택한 멘션 역할을 찾을 수 없어요. 다시 시도해 주세요.",
        });
        return;
      }

      mentionRoleId = mentionRole.id;
    }

    if (!title) {
      await safeInteractionEditReply(interaction, {
        content: "모집 제목을 입력해 주세요.",
      });
      return;
    }

    if (error || !Number.isInteger(limit)) {
      await safeInteractionEditReply(interaction, {
        content: error ?? "모집 인원을 확인해 주세요.",
      });
      return;
    }

    if (timeoutError || !Number.isInteger(timeoutMinutes)) {
      await safeInteractionEditReply(interaction, {
        content: timeoutError ?? "시간 제한을 확인해 주세요.",
      });
      return;
    }

    const now = Date.now();
    const expiresAtMs = now + timeoutMinutes * 60 * 1000;

    const queueRecord = {
      queueId: createQueueId(),
      guildId: interaction.guild.id,
      channelId: targetChannel.id,
      messageId: null,
      creatorUserId: interaction.user.id,
      mentionRoleId,
      title: title.slice(0, 100),
      limit,
      timeoutMinutes,
      expiresAtMs,
      note: note.slice(0, 300),
      participants: [interaction.user.id],
      status: "open",
      closedByUserId: null,
      createdAtMs: now,
      closedAtMs: null,
    };

    if (mentionRoleId) {
      await targetChannel.send({
        content: `<@&${mentionRoleId}>`,
        allowedMentions: {
          roles: [mentionRoleId],
        },
      });
    }

    const payload = buildQueueMessagePayload(queueRecord);
    const queueMessage = await targetChannel.send(payload);

    await createQueueRecord({
      ...queueRecord,
      messageId: queueMessage.id,
    });

    scheduleQueueTimeout({
      ...queueRecord,
      messageId: queueMessage.id,
    });

    await safeInteractionDeleteReply(interaction);
  } catch (error) {
    console.error("선착 생성 제출 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "선착순을 만드는 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.deferred) {
      await safeInteractionEditReply(interaction, {
        content: "선착순을 만드는 중 오류가 발생했어요.",
      });
    }
  }
}

async function refreshQueueMessage(interaction, queue) {
  if (interaction.message?.id === queue.messageId) {
    await interaction.message.edit(buildQueueMessagePayload(queue));
    return;
  }

  if (!interaction.guild) {
    return;
  }

  await refreshQueueMessageByGuild(interaction.guild, queue);
}

async function refreshQueueMessageByGuild(guild, queue) {
  const payload = buildQueueMessagePayload(queue);

  const targetChannel =
    guild.channels.cache.get(queue.channelId) ??
    (await guild.channels.fetch(queue.channelId).catch(() => null));

  if (!targetChannel?.isTextBased() || !("messages" in targetChannel)) {
    return;
  }

  const targetMessage = await targetChannel.messages.fetch(queue.messageId).catch(() => null);

  if (!targetMessage) {
    return;
  }

  await targetMessage.edit(payload);
}

function clearQueueTimeout(queueId) {
  const timeoutJob = queueTimeoutJobs.get(queueId);

  if (timeoutJob) {
    clearTimeout(timeoutJob);
    queueTimeoutJobs.delete(queueId);
  }
}

function scheduleQueueTimeout(queue) {
  if (
    !queue ||
    queue.status !== "open" ||
    !Number.isFinite(queue.expiresAtMs)
  ) {
    return;
  }

  clearQueueTimeout(queue.queueId);

  const delay = Math.max(0, queue.expiresAtMs - Date.now());
  const timeoutJob = setTimeout(() => {
    closeQueueByTimeout(queue.queueId).catch((error) => {
      console.error("선착순 시간 만료 자동 마감 실패", error);
    });
  }, delay);

  queueTimeoutJobs.set(queue.queueId, timeoutJob);
}

async function closeQueueByTimeout(queueId) {
  const queue = await getQueueRecord(queueId);

  if (!queue) {
    clearQueueTimeout(queueId);
    return null;
  }

  if (queue.status !== "open") {
    clearQueueTimeout(queueId);
    return queue;
  }

  if (!Number.isFinite(queue.expiresAtMs)) {
    return queue;
  }

  if (Date.now() < queue.expiresAtMs) {
    scheduleQueueTimeout(queue);
    return queue;
  }

  const closedQueue = await saveQueueRecord({
    ...queue,
    status: "closed",
    closedByUserId: null,
    closedAtMs: Date.now(),
  });

  clearQueueTimeout(queueId);

  const guild =
    client.guilds.cache.get(closedQueue.guildId) ??
    (await client.guilds.fetch(closedQueue.guildId).catch(() => null));

  if (guild) {
    await refreshQueueMessageByGuild(guild, closedQueue);
  }

  return closedQueue;
}

async function closeQueueIfExpired(queue) {
  if (!queue || queue.status !== "open") {
    return queue;
  }

  if (!Number.isFinite(queue.expiresAtMs)) {
    return queue;
  }

  if (Date.now() < queue.expiresAtMs) {
    scheduleQueueTimeout(queue);
    return queue;
  }

  return closeQueueByTimeout(queue.queueId);
}

async function handleQueueButtonInteraction(interaction) {
  try {
    const [, , action, queueId] = interaction.customId.split(":");

    if (!interaction.guild || !action || !queueId) {
      await safeInteractionReply(interaction, {
        content: "유효하지 않은 선착순 버튼이에요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const didDefer = await safeDeferEphemeral(interaction);

    if (!didDefer) {
      return;
    }

    const fetchedQueue = await getQueueRecord(queueId);
    const queue = await closeQueueIfExpired(fetchedQueue);

    if (!queue || queue.guildId !== interaction.guild.id) {
      await safeInteractionEditReply(interaction, {
        content: "선착순 정보를 찾을 수 없어요.",
      });
      return;
    }

    if (action === "status") {
      await safeInteractionEditReply(interaction, {
        embeds: [buildQueueStatusEmbed(queue, `${queue.title} - 선착순 현황`)],
      });
      return;
    }

    if (action === "join") {
      if (queue.status !== "open") {
        await safeInteractionEditReply(interaction, {
          content: "이미 마감된 선착순이에요.",
        });
        return;
      }

      if (queue.participants.includes(interaction.user.id)) {
        await safeInteractionEditReply(interaction, {
          content: "이미 참가 중이에요.",
        });
        return;
      }

      if (queue.participants.length >= queue.limit) {
        await safeInteractionEditReply(interaction, {
          content: "모집 인원이 모두 찼어요.",
        });
        return;
      }

      const savedQueue = await saveQueueRecord({
        ...queue,
        participants: [...queue.participants, interaction.user.id],
      });

      await refreshQueueMessage(interaction, savedQueue);

      await safeInteractionDeleteReply(interaction);
      return;
    }

    if (action === "leave") {
      if (queue.status !== "open") {
        await safeInteractionEditReply(interaction, {
          content: "이미 마감된 선착순이에요.",
        });
        return;
      }

      if (!queue.participants.includes(interaction.user.id)) {
        await safeInteractionEditReply(interaction, {
          content: "현재 참가자가 아니에요.",
        });
        return;
      }

      const nextParticipants = queue.participants.filter(
        (userId) => userId !== interaction.user.id,
      );

      const nextQueue =
        nextParticipants.length === 0
          ? {
              ...queue,
              participants: [],
              status: "closed",
              closedByUserId: interaction.user.id,
              closedAtMs: Date.now(),
            }
          : {
              ...queue,
              participants: nextParticipants,
            };

      const savedQueue = await saveQueueRecord(nextQueue);
      if (savedQueue.status === "closed") {
        clearQueueTimeout(savedQueue.queueId);
      }
      await refreshQueueMessage(interaction, savedQueue);

      await safeInteractionDeleteReply(interaction);
      return;
    }

    if (action === "end") {
      const canCloseQueue =
        interaction.user.id === queue.creatorUserId ||
        (await isAdminUser(interaction.guild, interaction.user.id));

      if (!canCloseQueue) {
        await safeInteractionEditReply(interaction, {
          content: "선착순 마감은 관리자 또는 생성자만 가능해요.",
        });
        return;
      }

      if (queue.status === "closed") {
        await safeInteractionEditReply(interaction, {
          content: "이미 마감된 선착순이에요.",
        });
        return;
      }

      const closedQueue = await saveQueueRecord({
        ...queue,
        status: "closed",
        closedByUserId: interaction.user.id,
        closedAtMs: Date.now(),
      });

      clearQueueTimeout(closedQueue.queueId);

      await refreshQueueMessage(interaction, closedQueue);

      await safeInteractionDeleteReply(interaction);
      return;
    }

    await safeInteractionEditReply(interaction, {
      content: "알 수 없는 선착순 버튼 동작이에요.",
    });
  } catch (error) {
    console.error("선착 버튼 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "선착순 버튼 처리 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.deferred) {
      await safeInteractionEditReply(interaction, {
        content: "선착순 버튼 처리 중 오류가 발생했어요.",
      });
    }
  }
}

async function handleRolePanelCommand(interaction) {
  try {
    const guild = interaction.guild;

    if (!guild) {
      await safeInteractionReply(interaction, {
        content: "이 명령어는 서버에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== ROLE_PANEL_CREATE_SUBCOMMAND_NAME) {
      await safeInteractionReply(interaction, {
        content: "알 수 없는 역할지급 명령어예요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const hasAdminPermission = await isAdminUser(guild, interaction.user.id);

    if (!hasAdminPermission) {
      await safeInteractionReply(interaction, {
        content: "서버 관리자만 역할지급 패널을 만들 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetChannel = interaction.options.getChannel("채널", true);
    const targetRole = interaction.options.getRole("역할", true);

    if (!isQueueTextChannel(targetChannel)) {
      await safeInteractionReply(interaction, {
        content: "패널 채널은 일반 텍스트 채널 또는 공지 채널만 선택할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (targetRole.id === guild.id) {
      await safeInteractionReply(interaction, {
        content: "@everyone 역할은 지급 대상으로 선택할 수 없어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const didDefer = await safeDeferEphemeral(interaction);

    if (!didDefer) {
      return;
    }

    const me = guild.members.me ?? (await guild.members.fetchMe());
    const canSendPanel = targetChannel.permissionsFor(me)?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ReadMessageHistory,
    ]);

    if (!canSendPanel) {
      await safeInteractionEditReply(interaction, {
        content:
          "해당 채널에 패널을 만들 권한이 없어요. View/Send/Add Reactions/Read History 권한을 확인해 주세요.",
      });
      return;
    }

    const emojiInput = interaction.options.getString("이모지")?.trim() || "✅";
    const panelTitle =
      interaction.options.getString("제목")?.trim() || "자동 역할 지급";
    const panelGuide =
      interaction.options.getString("안내")?.trim() ||
      `${emojiInput} 반응을 누르면 <@&${targetRole.id}> 역할이 지급/해제됩니다.`;

    const panelEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(panelTitle.slice(0, 80))
      .setDescription(panelGuide.slice(0, 4096));

    const panelMessage = await targetChannel.send({ embeds: [panelEmbed] });

    let reaction = null;

    try {
      reaction = await panelMessage.react(emojiInput);
    } catch {
      await panelMessage.delete().catch(() => null);
      await safeInteractionEditReply(interaction, {
        content: "이모지를 확인할 수 없어 패널을 만들지 못했어요.",
      });
      return;
    }

    const emojiSnapshot = serializeReactionEmoji(reaction.emoji);

    if (!emojiSnapshot.emojiName) {
      await panelMessage.delete().catch(() => null);
      await safeInteractionEditReply(interaction, {
        content: "이모지 정보를 읽지 못해 패널을 만들지 못했어요.",
      });
      return;
    }

    await createReactionRolePanel({
      messageId: panelMessage.id,
      guildId: guild.id,
      channelId: targetChannel.id,
      roleId: targetRole.id,
      emojiId: emojiSnapshot.emojiId,
      emojiName: emojiSnapshot.emojiName,
      createdByUserId: interaction.user.id,
      createdAtMs: Date.now(),
    });

    await safeInteractionEditReply(interaction, {
      content: `<#${targetChannel.id}> 채널에 역할지급 패널을 만들었어요.`,
    });
  } catch (error) {
    console.error("역할지급 명령어 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "역할지급 패널 생성 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.deferred) {
      await safeInteractionEditReply(interaction, {
        content: "역할지급 패널 생성 중 오류가 발생했어요.",
      });
    }
  }
}

async function handleProfanityCommand(interaction) {
  try {
    const guild = interaction.guild;
    const rawSubcommandGroup = interaction.options.getSubcommandGroup(false);
    const rawSubcommand = interaction.options.getSubcommand(false);
    const fallbackToChannelCategory =
      !rawSubcommandGroup &&
      (rawSubcommand === PROFANITY_ENABLE_SUBCOMMAND_NAME ||
        rawSubcommand === PROFANITY_DISABLE_SUBCOMMAND_NAME ||
        rawSubcommand === PROFANITY_STATUS_SUBCOMMAND_NAME);
    const subcommandGroup = fallbackToChannelCategory
      ? PROFANITY_CHANNEL_GROUP_NAME
      : rawSubcommandGroup;
    const subcommand = rawSubcommand;

    if (!guild) {
      await safeInteractionReply(interaction, {
        content: "이 명령어는 서버에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!subcommandGroup || !subcommand) {
      await safeInteractionReply(interaction, {
        content: "알 수 없는 욕설감지 카테고리예요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      subcommandGroup === PROFANITY_CHANNEL_GROUP_NAME &&
      !isProfanityTargetChannel(interaction.channel)
    ) {
      await safeInteractionReply(interaction, {
        content: "채널 카테고리는 텍스트 채널에서만 설정할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const hasAdminPermission = await isAdminUser(guild, interaction.user.id);

    if (!hasAdminPermission) {
      await safeInteractionReply(interaction, {
        content: "서버 관리자만 욕설감지 설정을 변경할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const didDefer = await safeDeferEphemeral(interaction);

    if (!didDefer) {
      return;
    }

    const channelId = interaction.channelId;
    const channelMention = `<#${channelId}>`;
    const profanityConfig = await getProfanityConfig(guild.id);

    if (subcommandGroup === PROFANITY_CHANNEL_GROUP_NAME) {
      const alreadyEnabled = profanityConfig.enabledChannelIds.includes(channelId);

      if (subcommand === PROFANITY_STATUS_SUBCOMMAND_NAME) {
        await safeInteractionEditReply(interaction, {
          content:
            `${channelMention} 욕설감지 상태: ` +
            `${alreadyEnabled ? "켜짐" : "꺼짐"}`,
        });
        return;
      }

      if (subcommand === PROFANITY_ENABLE_SUBCOMMAND_NAME) {
        if (alreadyEnabled) {
          await safeInteractionEditReply(interaction, {
            content: `${channelMention}은(는) 이미 욕설감지가 켜져 있어요.`,
          });
          return;
        }

        await setProfanityChannelEnabled(guild.id, channelId, true);

        await safeInteractionEditReply(interaction, {
          content:
            `${channelMention}에서 욕설감지를 켰어요. ` +
            "감지된 메시지는 바로 삭제됩니다.",
        });
        return;
      }

      if (subcommand === PROFANITY_DISABLE_SUBCOMMAND_NAME) {
        if (!alreadyEnabled) {
          await safeInteractionEditReply(interaction, {
            content: `${channelMention}은(는) 이미 욕설감지가 꺼져 있어요.`,
          });
          return;
        }

        await setProfanityChannelEnabled(guild.id, channelId, false);

        await safeInteractionEditReply(interaction, {
          content: `${channelMention}에서 욕설감지를 껐어요.`,
        });
        return;
      }

      await safeInteractionEditReply(interaction, {
        content: "알 수 없는 욕설감지 채널 명령어예요.",
      });
      return;
    }

    if (subcommandGroup === PROFANITY_WORD_GROUP_NAME) {
      const currentTerms = profanityConfig.customBlockedTerms;

      if (subcommand === PROFANITY_LIST_SUBCOMMAND_NAME) {
        await safeInteractionEditReply(interaction, {
          content: buildProfanityListContent("커스텀 금칙어", currentTerms),
        });
        return;
      }

      const rawInput = interaction.options.getString("값", true);
      const normalizedInput = normalizeProfanityTermInput(rawInput);

      if (!normalizedInput) {
        await safeInteractionEditReply(interaction, {
          content: "한글/영문 글자가 포함된 단어만 등록할 수 있어요.",
        });
        return;
      }

      if (subcommand === PROFANITY_ADD_SUBCOMMAND_NAME) {
        if (currentTerms.includes(normalizedInput)) {
          await safeInteractionEditReply(interaction, {
            content: `이미 등록된 금칙어예요: ${normalizedInput}`,
          });
          return;
        }

        await updateProfanityConfig(guild.id, {
          customBlockedTerms: [...currentTerms, normalizedInput],
        });

        await safeInteractionEditReply(interaction, {
          content: `금칙어를 추가했어요: ${normalizedInput}`,
        });
        return;
      }

      if (subcommand === PROFANITY_REMOVE_SUBCOMMAND_NAME) {
        if (!currentTerms.includes(normalizedInput)) {
          await safeInteractionEditReply(interaction, {
            content: `등록된 금칙어가 아니에요: ${normalizedInput}`,
          });
          return;
        }

        await updateProfanityConfig(guild.id, {
          customBlockedTerms: currentTerms.filter(
            (term) => term !== normalizedInput,
          ),
        });

        await safeInteractionEditReply(interaction, {
          content: `금칙어를 삭제했어요: ${normalizedInput}`,
        });
        return;
      }

      await safeInteractionEditReply(interaction, {
        content: "알 수 없는 욕설감지 단어 명령어예요.",
      });
      return;
    }

    if (subcommandGroup === PROFANITY_EXCEPTION_GROUP_NAME) {
      const currentTerms = profanityConfig.customAllowedTerms;

      if (subcommand === PROFANITY_LIST_SUBCOMMAND_NAME) {
        await safeInteractionEditReply(interaction, {
          content: buildProfanityListContent("감지 예외 단어", currentTerms),
        });
        return;
      }

      const rawInput = interaction.options.getString("값", true);
      const normalizedInput = normalizeProfanityTermInput(rawInput);

      if (!normalizedInput) {
        await safeInteractionEditReply(interaction, {
          content: "한글/영문 글자가 포함된 단어만 등록할 수 있어요.",
        });
        return;
      }

      if (subcommand === PROFANITY_ADD_SUBCOMMAND_NAME) {
        if (currentTerms.includes(normalizedInput)) {
          await safeInteractionEditReply(interaction, {
            content: `이미 등록된 예외 단어예요: ${normalizedInput}`,
          });
          return;
        }

        await updateProfanityConfig(guild.id, {
          customAllowedTerms: [...currentTerms, normalizedInput],
        });

        await safeInteractionEditReply(interaction, {
          content: `감지 예외 단어를 추가했어요: ${normalizedInput}`,
        });
        return;
      }

      if (subcommand === PROFANITY_REMOVE_SUBCOMMAND_NAME) {
        if (!currentTerms.includes(normalizedInput)) {
          await safeInteractionEditReply(interaction, {
            content: `등록된 예외 단어가 아니에요: ${normalizedInput}`,
          });
          return;
        }

        await updateProfanityConfig(guild.id, {
          customAllowedTerms: currentTerms.filter(
            (term) => term !== normalizedInput,
          ),
        });

        await safeInteractionEditReply(interaction, {
          content: `감지 예외 단어를 삭제했어요: ${normalizedInput}`,
        });
        return;
      }

      await safeInteractionEditReply(interaction, {
        content: "알 수 없는 욕설감지 예외 명령어예요.",
      });
      return;
    }

    await safeInteractionEditReply(interaction, {
      content: "알 수 없는 욕설감지 카테고리예요.",
    });
  } catch (error) {
    console.error("욕설감지 명령어 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "욕설감지 명령어 처리 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.deferred) {
      await safeInteractionEditReply(interaction, {
        content: "욕설감지 명령어 처리 중 오류가 발생했어요.",
      });
    }
  }
}

function normalizeProfanityTermInput(rawInput) {
  if (typeof rawInput !== "string") {
    return "";
  }

  return rawInput
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}]+/gu, "")
    .trim();
}

function buildProfanityListContent(title, terms) {
  if (!Array.isArray(terms) || terms.length === 0) {
    return `${title}: 없음`;
  }

  const visibleTerms = terms.slice(0, 40);
  const lines = visibleTerms.map((term, index) => `${index + 1}. ${term}`);
  const remainingCount = terms.length - visibleTerms.length;

  if (remainingCount > 0) {
    lines.push(`...외 ${remainingCount}개`);
  }

  return `${title} (${terms.length}개)\n${lines.join("\n")}`;
}

function isProfanityTargetChannel(channel) {
  return (
    channel?.type === ChannelType.GuildText ||
    channel?.type === ChannelType.GuildAnnouncement ||
    channel?.type === ChannelType.PublicThread ||
    channel?.type === ChannelType.PrivateThread ||
    channel?.type === ChannelType.AnnouncementThread
  );
}

async function handleProfanityModerationMessage(message) {
  if (!message.guild || message.author.bot || !message.content) {
    return false;
  }

  if (!isProfanityTargetChannel(message.channel)) {
    return false;
  }

  const profanityConfig = await getProfanityConfig(message.guild.id);
  const isEnabled = profanityConfig.enabledChannelIds.includes(message.channelId);

  if (!isEnabled) {
    return false;
  }

  if (
    !containsProfanity(message.content, {
      extraTerms: profanityConfig.customBlockedTerms,
      exclusionPhrases: profanityConfig.customAllowedTerms,
    })
  ) {
    return false;
  }

  const me =
    message.guild.members.me ??
    (await message.guild.members.fetchMe().catch(() => null));

  if (!me) {
    return false;
  }

  const canDeleteMessage = message.channel.permissionsFor(me)?.has(
    PermissionFlagsBits.ManageMessages,
  );

  if (!canDeleteMessage) {
    return false;
  }

  await message.delete().catch(() => null);
  return true;
}

async function handleAutoRoleOnMemberJoin(member) {
  if (!member.guild || member.user?.bot) {
    return;
  }

  const autoRoleConfig = await getAutoRoleConfig(member.guild.id);

  if (!autoRoleConfig.enabled || !autoRoleConfig.joinRoleId) {
    return;
  }

  const role =
    member.guild.roles.cache.get(autoRoleConfig.joinRoleId) ??
    (await member.guild.roles.fetch(autoRoleConfig.joinRoleId).catch(() => null));

  if (!role || role.id === member.guild.id) {
    return;
  }

  if (member.roles.cache.has(role.id)) {
    return;
  }

  await member.roles.add(role, "동봇 자동 역할 지급");
}

async function handleReactionRoleToggle(reaction, user, shouldGrant) {
  if (!user || user.bot) {
    return;
  }

  let workingReaction = reaction;

  if (workingReaction.partial) {
    workingReaction = await workingReaction.fetch().catch(() => null);
  }

  if (!workingReaction?.message?.id || !workingReaction.message.guildId) {
    return;
  }

  const panel = await getReactionRolePanel(workingReaction.message.id);

  if (!panel || panel.guildId !== workingReaction.message.guildId) {
    return;
  }

  if (!isReactionRoleMatch(panel, workingReaction.emoji)) {
    return;
  }

  const guild =
    workingReaction.message.guild ??
    (await client.guilds.fetch(workingReaction.message.guildId).catch(() => null));

  if (!guild) {
    return;
  }

  const role =
    guild.roles.cache.get(panel.roleId) ??
    (await guild.roles.fetch(panel.roleId).catch(() => null));

  if (!role || role.id === guild.id) {
    return;
  }

  const member = await guild.members.fetch(user.id).catch(() => null);

  if (!member || member.user?.bot) {
    return;
  }

  if (shouldGrant) {
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role, "동봇 반응 역할 지급");
    }
    return;
  }

  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role, "동봇 반응 역할 해제");
  }
}

function serializeReactionEmoji(emoji) {
  return {
    emojiId: emoji.id ?? null,
    emojiName: emoji.name ?? null,
  };
}

function isReactionRoleMatch(panel, emoji) {
  if (panel.emojiId) {
    return emoji.id === panel.emojiId;
  }

  return !emoji.id && emoji.name === panel.emojiName;
}

async function handleCallRoomCommand(interaction) {
  try {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({
        content: "이 명령어는 서버에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = await guild.members.fetch(interaction.user.id);
    const currentVoiceChannel = member.voice.channel;

    if (!currentVoiceChannel || currentVoiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.reply({
        content: "먼저 수정할 통화방에 입장해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = await getGuildConfig(guild.id);
    const isManagedRoom = config.managedChannelIds.includes(currentVoiceChannel.id);

    if (!isManagedRoom || currentVoiceChannel.id === config.generatorChannelId) {
      await interaction.reply({
        content: "동봇이 생성한 음성 수다방에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "인원") {
      const userLimit = interaction.options.getInteger("값", true);
      await currentVoiceChannel.setUserLimit(
        userLimit,
        `동봇 명령어 요청: ${interaction.user.tag}`,
      );

      await interaction.reply({
        content:
          userLimit === 0
            ? "현재 통화방 최대 인원을 무제한으로 변경했어요."
            : `현재 통화방 최대 인원을 ${userLimit}명으로 변경했어요.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "이름") {
      const nextName = interaction.options.getString("값", true).trim();

      if (!nextName) {
        await interaction.reply({
          content: "통화방 이름은 비어 있을 수 없어요.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await currentVoiceChannel.setName(
        nextName,
        `동봇 명령어 요청: ${interaction.user.tag}`,
      );

      await interaction.reply({
        content: `현재 통화방 이름을 ${nextName}(으)로 변경했어요.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error("통화방 명령어 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "명령어 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.replied) {
      await interaction.followUp({
        content: "명령어 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleTtsCommand(interaction) {
  try {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand(false);

    if (!guild) {
      await safeInteractionReply(interaction, {
        content: "이 명령어는 서버에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand && subcommand !== TTS_ACTION_SUBCOMMAND_NAME) {
      await safeInteractionReply(interaction, {
        content: "알 수 없는 TTS 카테고리예요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const didDefer = await safeDeferEphemeral(interaction);

    if (!didDefer) {
      return;
    }

    const actionInput = interaction.options.getString("동작", true).trim();
    const normalizedAction = actionInput.toLowerCase();
    const resolvedVoiceFromInput = resolveVoiceFromTtsAction(actionInput);

    if (normalizedAction === "o") {
      const member = await guild.members.fetch(interaction.user.id);
      const currentVoiceChannel = member.voice.channel;

      if (!currentVoiceChannel || currentVoiceChannel.type !== ChannelType.GuildVoice) {
        await safeInteractionEditReply(interaction, {
          content: "TTS를 켜려면 먼저 음성 채널에 입장해 주세요.",
        });
        return;
      }

      const missingVoicePermissions = getMissingTtsVoicePermissions(currentVoiceChannel);

      if (missingVoicePermissions.length > 0) {
        await safeInteractionEditReply(interaction, {
          content:
            "해당 음성 채널에서 봇 권한이 부족해요: " +
            `${missingVoicePermissions.join(", ")}`,
        });
        return;
      }

      const ttsGuildConfig = await getTtsGuildConfig(guild.id);

      if (!ttsGuildConfig.inputMode) {
        await safeInteractionEditReply(interaction, {
          content:
            "TTS 입력 방식이 아직 설정되지 않았어요. `/초기설정`에서 먼저 설정해 주세요.",
        });
        return;
      }

      if (ttsGuildConfig.inputMode === TTS_GUILD_INPUT_MODE_CHANNEL) {
        const ttsTextChannel = await ensureTtsInputTextChannel(
          guild,
          ttsGuildConfig.textChannelId,
        );

        if (ttsGuildConfig.textChannelId !== ttsTextChannel.id) {
          await updateTtsGuildConfig(guild.id, {
            inputMode: TTS_GUILD_INPUT_MODE_CHANNEL,
            textChannelId: ttsTextChannel.id,
          });
        }

        try {
          await ensureTtsConnectionForChannel(currentVoiceChannel);
        } catch (error) {
          if (isVoiceConnectionAbortError(error)) {
            await safeInteractionEditReply(interaction, {
              content:
                "음성 채널 연결이 지연되고 있어요. 잠시 후 다시 시도하거나, 봇의 Connect/Speak 권한을 확인해 주세요.",
            });
            return;
          }

          throw error;
        }

        await setUserTtsEnabled(
          guild.id,
          interaction.user.id,
          true,
          ttsTextChannel.id,
        );

        await safeInteractionEditReply(interaction, {
          content:
            `TTS를 켰어요. <#${ttsTextChannel.id}> 채팅방에서 ` +
            "누구든 입력하면 읽어줄게요.",
        });
        return;
      }

      try {
        await ensureTtsConnectionForChannel(currentVoiceChannel);
      } catch (error) {
        if (isVoiceConnectionAbortError(error)) {
          await safeInteractionEditReply(interaction, {
            content:
              "음성 채널 연결이 지연되고 있어요. 잠시 후 다시 시도하거나, 봇의 Connect/Speak 권한을 확인해 주세요.",
          });
          return;
        }

        throw error;
      }

      await setUserTtsEnabled(
        guild.id,
        interaction.user.id,
        true,
        null,
      );

      await safeInteractionEditReply(interaction, {
        content: "TTS를 켰어요. 이제 서버 어디서든 입력한 메시지를 읽어줄게요.",
      });
      return;
    }

    if (normalizedAction === "x") {
      await setUserTtsEnabled(
        guild.id,
        interaction.user.id,
        false,
        undefined,
      );
      await maybeDisconnectTtsIfNoEnabledUser(guild.id);

      await safeInteractionEditReply(interaction, {
        content: "TTS를 껐어요.",
      });
      return;
    }

    if (normalizedAction === "설정" || normalizedAction === "setting") {
      const [config, ttsGuildConfig] = await Promise.all([
        getUserTtsConfig(guild.id, interaction.user.id),
        getTtsGuildConfig(guild.id),
      ]);
      const selectMenuRow = buildTtsLanguageSelectRow(
        guild.id,
        interaction.user.id,
        config.voiceShortName,
      );

      const modeSummary =
        ttsGuildConfig.inputMode === TTS_GUILD_INPUT_MODE_CHANNEL
          ? `전용 채팅방 모드 (${ttsGuildConfig.textChannelId ? `<#${ttsGuildConfig.textChannelId}>` : "채널 미지정"})`
          : ttsGuildConfig.inputMode === TTS_GUILD_INPUT_MODE_GUILD
            ? "자유 모드(어디서든)"
            : "미설정 (/초기설정에서 설정)";

      await safeInteractionEditReply(interaction, {
        content: `TTS 언어를 선택해 주세요.\n현재 입력 모드: ${modeSummary}`,
        components: [selectMenuRow],
      });
      return;
    }

    if (resolvedVoiceFromInput) {
      await setUserTtsVoice(guild.id, interaction.user.id, resolvedVoiceFromInput);

      await safeInteractionEditReply(interaction, {
        content: `TTS 언어를 ${ttsVoiceLabelMap.get(resolvedVoiceFromInput)}(으)로 설정했어요.`,
      });
      return;
    }

    await safeInteractionEditReply(interaction, {
      content:
        "사용법: /tts O, /tts X, /tts 설정, /tts 설정 한국어, /tts english",
    });
  } catch (error) {
    console.error("TTS 명령어 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "TTS 명령어 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.deferred) {
      await safeInteractionEditReply(interaction, {
        content: "TTS 명령어 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
      });
    }
  }
}

async function handleTtsTestCommand(interaction) {
  try {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand(false);

    if (!guild) {
      await safeInteractionReply(interaction, {
        content: "이 명령어는 서버에서만 사용할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand && subcommand !== TTS_TEST_RUN_SUBCOMMAND_NAME) {
      await safeInteractionReply(interaction, {
        content: "알 수 없는 TTS 테스트 카테고리예요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const didDefer = await safeDeferEphemeral(interaction);

    if (!didDefer) {
      return;
    }

    const member = await guild.members.fetch(interaction.user.id);
    const currentVoiceChannel = member.voice.channel;

    if (!currentVoiceChannel || currentVoiceChannel.type !== ChannelType.GuildVoice) {
      await safeInteractionEditReply(interaction, {
        content: "테스트를 하려면 먼저 음성 채널에 입장해 주세요.",
      });
      return;
    }

    const missingVoicePermissions = getMissingTtsVoicePermissions(currentVoiceChannel);

    if (missingVoicePermissions.length > 0) {
      await safeInteractionEditReply(interaction, {
        content:
          "해당 음성 채널에서 봇 권한이 부족해요: " +
          `${missingVoicePermissions.join(", ")}`,
      });
      return;
    }

    const requestedText = interaction.options.getString("문장")?.trim() ?? "";
    const testText = sanitizeForTts(requestedText) || DEFAULT_TTS_TEST_TEXT;
    const requestedVoice = interaction.options.getString("언어");
    const userTtsConfig = await getUserTtsConfig(guild.id, interaction.user.id);
    const voiceShortName = requestedVoice ?? userTtsConfig.voiceShortName;
    const runtime = getOrCreateTtsRuntime(guild.id);

    runtime.player.stop(true);

    let playedFormat = null;
    let lastError = null;

    for (const outputFormat of TTS_OUTPUT_FORMAT_FALLBACKS) {
      try {
        const connection = await ensureTtsConnectionForChannel(currentVoiceChannel);
        connection.subscribe(runtime.player);

        const audioStream = await synthesizeTtsAudioStream(
          testText,
          voiceShortName,
          outputFormat,
        );

        const resource = createAudioResource(audioStream, {
          inputType: StreamType.Arbitrary,
        });

        runtime.player.play(resource);
        await waitForTtsPlayback(runtime.player);

        playedFormat = outputFormat;
        break;
      } catch (error) {
        lastError = error;
        runtime.player.stop(true);

        if (isVoiceConnectionAbortError(error)) {
          getVoiceConnection(guild.id)?.destroy();
        }
      }
    }

    if (!playedFormat) {
      console.error("TTS 강제 테스트 재생 실패", lastError);

      await safeInteractionEditReply(interaction, {
        content:
          "강제 테스트 재생 실패: 음성 연결 또는 디코더 경로에서 오류가 났어요. " +
          "봇 콘솔 로그를 확인해 주세요.",
      });
      return;
    }

    await safeInteractionEditReply(interaction, {
      content:
        "강제 테스트 재생 성공.\n" +
        `- 음성: ${ttsVoiceLabelMap.get(voiceShortName) ?? voiceShortName}\n` +
        `- 포맷: ${playedFormat}\n` +
        `- 문장: ${testText}`,
    });
  } catch (error) {
    console.error("TTS 테스트 명령어 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await safeInteractionReply(interaction, {
        content: "TTS 테스트 명령어 처리 중 오류가 발생했어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.deferred) {
      await safeInteractionEditReply(interaction, {
        content: "TTS 테스트 명령어 처리 중 오류가 발생했어요.",
      });
    }
  }
}

async function ensureTtsInputTextChannel(guild, preferredChannelId) {
  let preferred = null;

  if (preferredChannelId) {
    preferred =
      guild.channels.cache.get(preferredChannelId) ??
      (await guild.channels.fetch(preferredChannelId).catch(() => null));
  }

  if (preferred?.type === ChannelType.GuildText) {
    return preferred;
  }

  const acceptedNames = new Set([
    DEFAULT_TTS_TEXT_CHANNEL_NAME,
    ...LEGACY_TTS_TEXT_CHANNEL_NAMES,
  ]);

  const foundByName = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText && acceptedNames.has(channel.name),
  );

  if (foundByName) {
    return foundByName;
  }

  return guild.channels.create({
    name: DEFAULT_TTS_TEXT_CHANNEL_NAME,
    type: ChannelType.GuildText,
  });
}

function resolveVoiceFromTtsAction(actionInput) {
  const trimmedInput = actionInput.trim();

  const setupWithLanguageMatch = /^(?:설정|setting)\s+(.+)$/i.exec(trimmedInput);

  const candidateKeyword = setupWithLanguageMatch
    ? setupWithLanguageMatch[1].trim().toLowerCase()
    : trimmedInput.toLowerCase();

  if (ttsLanguageAliasToVoice.has(candidateKeyword)) {
    return ttsLanguageAliasToVoice.get(candidateKeyword);
  }

  for (const option of TTS_LANGUAGE_OPTIONS) {
    if (option.value.toLowerCase() === candidateKeyword) {
      return option.value;
    }
  }

  return null;
}

async function handleTtsLanguageSelect(interaction) {
  try {
    const [, , guildId, targetUserId] = interaction.customId.split(":");

    if (!guildId || !targetUserId) {
      await interaction.reply({
        content: "유효하지 않은 설정 요청이에요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.user.id !== targetUserId) {
      await interaction.reply({
        content: "이 메뉴는 명령어를 실행한 사용자만 선택할 수 있어요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const selectedVoice = interaction.values[0];

    if (!ttsVoiceLabelMap.has(selectedVoice)) {
      await interaction.reply({
        content: "지원하지 않는 언어 설정이에요.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await setUserTtsVoice(guildId, targetUserId, selectedVoice);

    await interaction.update({
      content: `TTS 언어를 ${ttsVoiceLabelMap.get(selectedVoice)}(으)로 설정했어요.`,
      components: [],
    });
  } catch (error) {
    console.error("TTS 언어 설정 처리 실패", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "언어 설정 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

function buildTtsLanguageSelectRow(guildId, userId, selectedVoice) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${TTS_LANGUAGE_SELECT_PREFIX}${guildId}:${userId}`)
    .setPlaceholder("TTS 언어를 선택하세요")
    .addOptions(
      TTS_LANGUAGE_OPTIONS.map((option) => ({
        ...option,
        default: option.value === selectedVoice,
      })),
    );

  return new ActionRowBuilder().addComponents(selectMenu);
}

function canReadTtsInChannel(userConfig, ttsGuildConfig, channelId) {
  if (!userConfig?.enabled || !ttsGuildConfig?.inputMode) {
    return false;
  }

  if (ttsGuildConfig.inputMode === TTS_GUILD_INPUT_MODE_GUILD) {
    return true;
  }

  return (
    Boolean(ttsGuildConfig.textChannelId) &&
    ttsGuildConfig.textChannelId === channelId
  );
}

async function handleTtsMessage(message) {
  if (!message.guild || message.author.bot) {
    return;
  }

  const member =
    message.member ??
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  if (!member?.voice.channel || member.voice.channel.type !== ChannelType.GuildVoice) {
    return;
  }

  const [config, ttsGuildConfig] = await Promise.all([
    getUserTtsConfig(message.guild.id, message.author.id),
    getTtsGuildConfig(message.guild.id),
  ]);

  if (!ttsGuildConfig.inputMode) {
    return;
  }

  const isDedicatedRoomMode =
    ttsGuildConfig.inputMode === TTS_GUILD_INPUT_MODE_CHANNEL;

  if (isDedicatedRoomMode && message.channelId !== ttsGuildConfig.textChannelId) {
    return;
  }

  const isSenderEnabledForThisChannel = canReadTtsInChannel(
    config,
    ttsGuildConfig,
    message.channelId,
  );

  if (!isSenderEnabledForThisChannel) {
    const enabledConfigs = await getEnabledTtsConfigsInGuild(message.guild.id);

    if (isDedicatedRoomMode) {
      if (enabledConfigs.length === 0) {
        return;
      }
    } else {
      const voiceMemberIds = new Set(member.voice.channel.members.keys());

      const hasEnabledPeerForThisChannel = enabledConfigs.some(
        (enabledConfig) =>
          canReadTtsInChannel(enabledConfig, ttsGuildConfig, message.channelId) &&
          voiceMemberIds.has(enabledConfig.userId),
      );

      if (!hasEnabledPeerForThisChannel) {
        return;
      }
    }

    if (enabledConfigs.length === 0) {
      return;
    }
  }

  const ttsText = buildTtsText(message);

  if (!ttsText) {
    return;
  }

  enqueueTtsPlayback(
    message.guild,
    member.voice.channel,
    config.voiceShortName,
    ttsText,
  );
}

function buildTtsText(message) {
  const compactText = sanitizeForTts(message.content);

  if (compactText) {
    return compactText;
  }

  if (message.attachments.size > 0) {
    return "첨부파일을 보냈어요.";
  }

  return null;
}

function sanitizeForTts(rawText) {
  if (!rawText) {
    return "";
  }

  const withoutUrls = rawText.replace(/https?:\/\/\S+/gi, "링크");
  const withoutMentions = withoutUrls.replace(/<[@#&]!?(\d+)>/g, "멘션");
  const flattened = withoutMentions.replace(/\s+/g, " ").trim();

  if (!flattened) {
    return "";
  }

  return flattened.slice(0, MAX_TTS_TEXT_LENGTH);
}

function getMissingTtsVoicePermissions(voiceChannel) {
  const me = voiceChannel.guild.members.me;

  if (!me) {
    return ["봇 멤버 정보를 불러올 수 없음"];
  }

  const channelPermissions = voiceChannel.permissionsFor(me);

  if (!channelPermissions) {
    return ["권한 계산 실패"];
  }

  const missing = [];

  if (!channelPermissions.has(PermissionFlagsBits.ViewChannel)) {
    missing.push("채널 보기");
  }

  if (!channelPermissions.has(PermissionFlagsBits.Connect)) {
    missing.push("연결(Connect)");
  }

  if (!channelPermissions.has(PermissionFlagsBits.Speak)) {
    missing.push("발언(Speak)");
  }

  return missing;
}

function getOrCreateTtsRuntime(guildId) {
  if (ttsRuntimeByGuild.has(guildId)) {
    return ttsRuntimeByGuild.get(guildId);
  }

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
    },
  });

  const runtime = {
    player,
    queue: [],
    processing: false,
  };

  player.on("error", (error) => {
    console.error(`TTS 오디오 플레이어 오류 (guild=${guildId})`, error);
  });

  ttsRuntimeByGuild.set(guildId, runtime);
  return runtime;
}

function enqueueTtsPlayback(guild, voiceChannel, voiceShortName, text) {
  const runtime = getOrCreateTtsRuntime(guild.id);

  runtime.queue.push({
    guild,
    voiceChannel,
    voiceShortName,
    text,
  });

  if (!runtime.processing) {
    void processTtsQueue(guild.id);
  }
}

async function processTtsQueue(guildId) {
  const runtime = ttsRuntimeByGuild.get(guildId);

  if (!runtime || runtime.processing) {
    return;
  }

  runtime.processing = true;

  try {
    while (runtime.queue.length > 0) {
      const nextItem = runtime.queue.shift();

      if (!nextItem) {
        continue;
      }

      const missingVoicePermissions = getMissingTtsVoicePermissions(nextItem.voiceChannel);

      if (missingVoicePermissions.length > 0) {
        console.warn(
          `TTS 음성 권한 부족으로 건너뜀 (guild=${guildId}): ${missingVoicePermissions.join(
            ", ",
          )}`,
        );
        continue;
      }

      let attempt = 0;
      let playbackCompleted = false;

      while (attempt < TTS_OUTPUT_FORMAT_FALLBACKS.length && !playbackCompleted) {
        const outputFormat = TTS_OUTPUT_FORMAT_FALLBACKS[attempt];
        attempt += 1;

        try {
          const connection = await ensureTtsConnectionForChannel(nextItem.voiceChannel);
          connection.subscribe(runtime.player);

          const audioStream = await synthesizeTtsAudioStream(
            nextItem.text,
            nextItem.voiceShortName,
            outputFormat,
          );

          const resource = createAudioResource(audioStream, {
            // Probe reported this stream can be arbitrary, so let the transformer graph decode it.
            inputType: StreamType.Arbitrary,
          });

          runtime.player.play(resource);

          await waitForTtsPlayback(runtime.player);
          playbackCompleted = true;
        } catch (error) {
          const canRetry = attempt < TTS_OUTPUT_FORMAT_FALLBACKS.length;

          if (canRetry) {
            console.warn(
              `TTS 연결/재생 재시도 중 (guild=${guildId}, attempt=${attempt + 1}, format=${outputFormat})`,
              error,
            );
            runtime.player.stop(true);

            if (isVoiceConnectionAbortError(error)) {
              getVoiceConnection(guildId)?.destroy();
            }

            continue;
          }

          if (isVoiceConnectionAbortError(error)) {
            console.warn("TTS 음성 연결이 불안정하여 다음 큐로 넘어갑니다.");
          } else {
            console.error("TTS 재생 실패", error);
          }

          runtime.player.stop(true);
          break;
        }
      }
    }
  } finally {
    runtime.processing = false;
    await maybeDisconnectTtsIfNoEnabledUser(guildId);
  }
}

async function waitForTtsPlayback(player) {
  await new Promise((resolve, reject) => {
    let settled = false;
    let hasStarted = player.state.status === AudioPlayerStatus.Playing;
    let startTimeoutHandle = null;
    let endTimeoutHandle = null;

    const cleanup = () => {
      if (startTimeoutHandle) {
        clearTimeout(startTimeoutHandle);
      }

      if (endTimeoutHandle) {
        clearTimeout(endTimeoutHandle);
      }

      player.off("stateChange", handleStateChange);
      player.off("error", handleError);
    };

    const resolveOnce = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve();
    };

    const rejectOnce = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    const armEndTimeout = () => {
      if (endTimeoutHandle) {
        return;
      }

      endTimeoutHandle = setTimeout(() => {
        rejectOnce(new Error("TTS playback completion timed out"));
      }, TTS_PLAYBACK_END_TIMEOUT_MS);
    };

    const handleError = (error) => {
      rejectOnce(error);
    };

    const handleStateChange = (_oldState, newState) => {
      if (newState.status === AudioPlayerStatus.AutoPaused) {
        rejectOnce(new Error("TTS player entered auto-paused state"));
        return;
      }

      if (!hasStarted && newState.status === AudioPlayerStatus.Playing) {
        hasStarted = true;

        if (startTimeoutHandle) {
          clearTimeout(startTimeoutHandle);
          startTimeoutHandle = null;
        }

        armEndTimeout();
        return;
      }

      if (hasStarted && newState.status === AudioPlayerStatus.Idle) {
        resolveOnce();
      }
    };

    player.on("stateChange", handleStateChange);
    player.on("error", handleError);

    if (player.state.status === AudioPlayerStatus.AutoPaused) {
      rejectOnce(new Error("TTS player entered auto-paused state"));
      return;
    }

    if (hasStarted) {
      armEndTimeout();
      return;
    }

    startTimeoutHandle = setTimeout(() => {
      rejectOnce(new Error("TTS playback start timed out"));
    }, TTS_PLAYBACK_START_TIMEOUT_MS);
  });
}

async function ensureTtsConnectionForChannel(voiceChannel) {
  const guildId = voiceChannel.guild.id;
  const existingConnection = getVoiceConnection(guildId);

  if (existingConnection?.joinConfig.channelId === voiceChannel.id) {
    bindTtsVoiceConnectionHandlers(existingConnection, guildId, voiceChannel.id);

    try {
      await entersState(existingConnection, VoiceConnectionStatus.Ready, 12_000);
      return existingConnection;
    } catch {
      existingConnection.destroy();
    }
  } else if (existingConnection) {
    existingConnection.destroy();
  }

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      bindTtsVoiceConnectionHandlers(connection, guildId, voiceChannel.id);

      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      return connection;
    } catch (error) {
      lastError = error;
      getVoiceConnection(guildId)?.destroy();
    }
  }

  throw lastError ?? new Error("Failed to establish voice connection");
}

function bindTtsVoiceConnectionHandlers(connection, guildId, channelId) {
  if (!connection || handledTtsVoiceConnections.has(connection)) {
    return;
  }

  handledTtsVoiceConnections.add(connection);

  // VoiceConnection emits "error" and will crash the process if nobody handles it.
  connection.on("error", (error) => {
    console.warn(
      `TTS 음성 연결 오류 (guild=${guildId}, channel=${channelId})`,
      error,
    );
  });
}

function isVoiceConnectionAbortError(error) {
  const message = typeof error?.message === "string" ? error.message : "";

  return (
    error?.code === "ABORT_ERR" ||
    error?.name === "AbortError" ||
    message.includes("Cannot perform IP discovery - socket closed") ||
    message.includes("TTS playback start timed out") ||
    message.includes("TTS playback completion timed out")
  );
}

async function synthesizeTtsAudioStream(text, voiceShortName, outputFormat) {
  const tts = new MsEdgeTTS();
  const safeText = escapeXml(text);

  await tts.setMetadata(voiceShortName, outputFormat);

  const { audioStream } = tts.toStream(safeText);

  const closeTtsConnection = () => {
    try {
      tts.close();
    } catch {
      // noop
    }
  };

  audioStream.once("end", closeTtsConnection);
  audioStream.once("close", closeTtsConnection);
  audioStream.once("error", closeTtsConnection);

  return audioStream;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function maybeDisconnectTtsIfNoEnabledUser(guildId) {
  const runtime = ttsRuntimeByGuild.get(guildId);
  const hasEnabledUsers = await hasEnabledTtsUsersInGuild(guildId);

  if (hasEnabledUsers) {
    return;
  }

  if (runtime && (runtime.processing || runtime.queue.length > 0)) {
    return;
  }

  const connection = getVoiceConnection(guildId);
  connection?.destroy();
}

function buildSetupComponents(guild) {
  const categoryOptions = [
    {
      label: "카테고리 없음 (서버 루트)",
      value: ROOT_CATEGORY_VALUE,
      description: "기준 채널과 수다방을 카테고리 없이 생성합니다.",
    },
  ];

  const categories = [...guild.channels.cache.values()]
    .filter((channel) => channel.type === ChannelType.GuildCategory)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .slice(0, 24);

  for (const category of categories) {
    categoryOptions.push({
      label: category.name.slice(0, 100),
      value: category.id,
      description: "선택한 카테고리에 방 생성 채널과 수다방을 만듭니다.",
    });
  }

  const categorySelectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${ROOM_CATEGORY_SELECT_PREFIX}${guild.id}`)
      .setPlaceholder("방 생성 채널을 넣을 카테고리를 선택하세요")
      .addOptions(categoryOptions),
  );

  const quickAddRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ROOM_SETUP_BUTTON_PREFIX}${guild.id}`)
      .setLabel("빠른 추가 (기본 위치)")
      .setStyle(ButtonStyle.Success),
  );

  return [categorySelectRow, quickAddRow];
}

async function ensureRoomGeneratorChannel(guild, preferredCategoryId) {
  const config = await getGuildConfig(guild.id);
  const hasPreferredCategory = preferredCategoryId !== undefined;
  const desiredCategoryId = hasPreferredCategory
    ? preferredCategoryId
    : config.generatorCategoryId;

  const foundByConfig = config.generatorChannelId
    ? guild.channels.cache.get(config.generatorChannelId)
    : null;

  if (foundByConfig?.type === ChannelType.GuildVoice) {
    return ensureVoiceChannelParent(foundByConfig, desiredCategoryId);
  }

  const foundByName = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildVoice &&
      channel.name === roomGeneratorChannelName,
  );

  if (foundByName) {
    return ensureVoiceChannelParent(foundByName, desiredCategoryId);
  }

  return guild.channels.create({
    name: roomGeneratorChannelName,
    type: ChannelType.GuildVoice,
    parent: desiredCategoryId ?? undefined,
  });
}

async function ensureVoiceChannelParent(channel, desiredCategoryId) {
  if (channel.parentId === desiredCategoryId) {
    return channel;
  }

  await channel.setParent(desiredCategoryId ?? null);
  return channel;
}

async function handleJoinRoomGenerator(oldState, newState) {
  if (!newState.channelId || oldState.channelId === newState.channelId) {
    return;
  }

  if (newState.member?.user.bot) {
    return;
  }

  const config = await getGuildConfig(newState.guild.id);

  if (!config.enabled || config.generatorChannelId !== newState.channelId) {
    return;
  }

  const generatorChannel = newState.channel;
  if (!generatorChannel || generatorChannel.type !== ChannelType.GuildVoice) {
    return;
  }

  const roomNumber = getNextRoomNumber(newState.guild);
  const createdChannel = await newState.guild.channels.create({
    name: `${roomPrefix} ${roomNumber}`,
    type: ChannelType.GuildVoice,
    parent: generatorChannel.parentId ?? undefined,
  });

  await addManagedChannel(newState.guild.id, createdChannel.id);

  if (newState.channelId === config.generatorChannelId) {
    await newState.setChannel(createdChannel);
  }
}

async function handleEmptyManagedChannel(oldState, newState) {
  const oldChannel = oldState.channel;

  if (!oldChannel || oldState.channelId === newState.channelId) {
    return;
  }

  if (oldChannel.type !== ChannelType.GuildVoice || oldChannel.members.size > 0) {
    return;
  }

  const config = await getGuildConfig(oldState.guild.id);

  if (
    oldChannel.id === config.generatorChannelId ||
    !config.managedChannelIds.includes(oldChannel.id)
  ) {
    return;
  }

  try {
    await oldChannel.delete("동봇 자동 삭제: 빈 음성 수다방");
  } finally {
    await removeManagedChannel(oldState.guild.id, oldChannel.id);
  }
}

function getNextRoomNumber(guild) {
  const usedNumbers = new Set();
  const roomNameRegex = new RegExp(`^${escapeRegex(roomPrefix)} (\\d+)$`);

  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildVoice) {
      continue;
    }

    const match = roomNameRegex.exec(channel.name);
    if (!match) {
      continue;
    }

    usedNumbers.add(Number.parseInt(match[1], 10));
  }

  let number = 1;

  while (usedNumbers.has(number)) {
    number += 1;
  }

  return number;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

async function runGuildTask(guildId, task) {
  const previousTask = guildTaskQueue.get(guildId) ?? Promise.resolve();

  const nextTask = previousTask.catch(() => null).then(task);
  guildTaskQueue.set(guildId, nextTask);

  try {
    return await nextTask;
  } finally {
    if (guildTaskQueue.get(guildId) === nextTask) {
      guildTaskQueue.delete(guildId);
    }
  }
}

await client.login(discordToken);