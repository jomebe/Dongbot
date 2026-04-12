import { MessageFlags } from "discord.js";

function isIgnorableInteractionError(error) {
  return error?.code === 10062 || error?.code === 40060;
}

export async function safeInteractionReply(interaction, payload) {
  try {
    await interaction.reply(payload);
    return true;
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      return false;
    }

    throw error;
  }
}

export async function safeInteractionEditReply(interaction, payload) {
  try {
    await interaction.editReply(payload);
    return true;
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      return false;
    }

    throw error;
  }
}

export async function safeInteractionDeleteReply(interaction) {
  try {
    await interaction.deleteReply();
    return true;
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      return false;
    }

    throw error;
  }
}

export async function safeDeferEphemeral(interaction) {
  if (interaction.deferred || interaction.replied) {
    return true;
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return true;
  } catch (error) {
    if (isIgnorableInteractionError(error)) {
      return false;
    }

    throw error;
  }
}
