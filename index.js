require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, REST, Routes, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const CHANNEL_NAME = 'generator';
const LINK_CHANNEL_NAME = 'link-na-url';
const TEMPLATE_STOCKX = 'stockx_new.html';
const LIMITS_FILE = 'user_limits.json';
const ACCESS_FILE = 'user_access.json';
const FORM_TRACKER_FILE = 'form_tracker.json';
const EMAILS_FILE = 'user_emails.json';
const SETTINGS_FILE = 'user_settings.json';

const TEMPLATE_CONFIG = {
  stockx: {
    file: 'stockx_new.html',
    needsStyleId: true,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false
  },
  apple: {
    file: 'apple.html',
    needsStyleId: false,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsQuantity: true,
    needsShippingAddress: true
  },
  balenciaga: {
    file: 'balenciaga.html',
    needsStyleId: false,
    needsColour: true,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: true,
    needsWholeName: false
  },
  bape: {
    file: 'bape.html',
    needsStyleId: true,
    needsColour: false,
    needsTaxes: true,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsCurrency: true,
    needsModal3: true
  },
  dior: {
    file: 'dior.html',
    needsStyleId: false,
    needsColour: false,
    needsTaxes: true,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false
  },
  lv: {
    file: 'lv.html',
    needsStyleId: false,
    needsColour: false,
    needsTaxes: false,
    needsReference: true,
    needsFirstName: false,
    needsWholeName: false,
    needsPhoneNumber: false
  },
  moncler: {
    file: 'moncler.html',
    needsStyleId: false,
    needsColour: true,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsEstimatedDelivery: true,
    needsCardEnd: true,
    needsModal3: true
  },
  nike: {
    file: 'nike.html',
    needsStyleId: false,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsCurrency: true,
    needsCardEnd: true
  },
  stussy: {
    file: 'stussy.html',
    needsStyleId: true,
    needsColour: false,
    needsTaxes: true,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false
  },
  trapstar: {
    file: 'trapstar.html',
    needsStyleId: true,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false
  }
};

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  logger: true,
  debug: true,
});

const readTpl = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const loadLimits = () => {
  try {
    if (fs.existsSync(LIMITS_FILE)) {
      return JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Błąd wczytywania limitów:', e);
  }
  return {};
};

const saveLimits = (limits) => {
  try {
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(limits, null, 2));
  } catch (e) {
    console.error('Błąd zapisywania limitów:', e);
  }
};

const getUserLimit = (userId) => {
  const limits = loadLimits();
  return limits[userId] !== undefined ? limits[userId] : -1;
};

const setUserLimit = (userId, limit) => {
  const limits = loadLimits();
  limits[userId] = limit;
  saveLimits(limits);
};

const decreaseUserLimit = (userId) => {
  const limits = loadLimits();
  if (limits[userId] !== undefined) {
    if (limits[userId] > 0) {
      limits[userId]--;
      saveLimits(limits);
    }
    return limits[userId];
  }
  return -1;
};

const loadAccess = () => {
  try {
    if (fs.existsSync(ACCESS_FILE)) {
      return JSON.parse(fs.readFileSync(ACCESS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Błąd wczytywania dostępu:', e);
  }
  return {};
};

const saveAccess = (access) => {
  try {
    fs.writeFileSync(ACCESS_FILE, JSON.stringify(access, null, 2));
  } catch (e) {
    console.error('Błąd zapisywania dostępu:', e);
  }
};

const setUserAccess = (userId, days) => {
  const access = loadAccess();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  access[userId] = expiryDate.toISOString();
  saveAccess(access);
  return expiryDate;
};

const checkUserAccess = (userId) => {
  const access = loadAccess();
  if (!access[userId]) {
    return { hasAccess: true, unlimited: true };
  }
  const expiryDate = new Date(access[userId]);
  const now = new Date();
  if (now > expiryDate) {
    return { hasAccess: false, expired: true, expiryDate };
  }
  return { hasAccess: true, unlimited: false, expiryDate };
};

const loadFormTracker = () => {
  try {
    if (fs.existsSync(FORM_TRACKER_FILE)) {
      return JSON.parse(fs.readFileSync(FORM_TRACKER_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Błąd wczytywania trackera formularzy:', e);
  }
  return {};
};

const saveFormTracker = (tracker) => {
  try {
    fs.writeFileSync(FORM_TRACKER_FILE, JSON.stringify(tracker, null, 2));
  } catch (e) {
    console.error('Błąd zapisywania trackera formularzy:', e);
  }
};

const loadEmails = () => {
  try {
    if (fs.existsSync(EMAILS_FILE)) {
      return JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Błąd wczytywania emaili:', e);
  }
  return {};
};

const saveEmails = (emails) => {
  try {
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
  } catch (e) {
    console.error('Błąd zapisywania emaili:', e);
  }
};

const getUserEmail = (userId) => {
  const emails = loadEmails();
  return emails[userId] || null;
};

const setUserEmail = (userId, email) => {
  const emails = loadEmails();
  emails[userId] = email;
  saveEmails(emails);
};

const loadSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Błąd wczytywania ustawień:', e);
  }
  return {};
};

const saveSettings = (settings) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Błąd zapisywania ustawień:', e);
  }
};

const setUserSettings = (userId, settings) => {
  const allSettings = loadSettings();
  allSettings[userId] = settings;
  saveSettings(allSettings);
};

const getUserSettings = (userId) => {
  const allSettings = loadSettings();
  return allSettings[userId] || null;
};

const commands = [
  new SlashCommandBuilder()
    .setName('setlimit')
    .setDescription('Ustaw limit użyć formularza dla użytkownika (tylko admin)')
    .addUserOption(option =>
      option.setName('użytkownik')
        .setDescription('Użytkownik dla którego ustawiasz limit')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('liczba')
        .setDescription('Liczba dozwolonych użyć (0 = brak dostępu)')
        .setRequired(true)
        .setMinValue(0))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('resetlimit')
    .setDescription('Usuń limit dla użytkownika - nieograniczone użycia (tylko admin)')
    .addUserOption(option =>
      option.setName('użytkownik')
        .setDescription('Użytkownik któremu resetujesz limit')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('resetlimits')
    .setDescription('Zresetuj wszystkie limity - wszyscy mają nieograniczone użycia (tylko admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('checklimit')
    .setDescription('Sprawdź limit użyć formularza')
    .addUserOption(option =>
      option.setName('użytkownik')
        .setDescription('Użytkownik którego limit chcesz sprawdzić (tylko admin)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('grantaccess')
    .setDescription('Daj użytkownikowi dostęp do formularza na określoną liczbę dni (tylko admin)')
    .addUserOption(option =>
      option.setName('użytkownik')
        .setDescription('Użytkownik któremu dajesz dostęp')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('dni')
        .setDescription('Liczba dni dostępu')
        .setRequired(true)
        .setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('checkaccess')
    .setDescription('Sprawdź ile dni dostępu do formularza zostało')
    .addUserOption(option =>
      option.setName('użytkownik')
        .setDescription('Użytkownik którego dostęp chcesz sprawdzić (tylko admin)')
        .setRequired(false))
].map(command => command.toJSON());

async function registerSlashCommands() {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  
  try {
    console.log('🔄 Rejestrowanie slash commands na serwerze...');
    
    const data = await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands }
    );

    console.log(`✅ Zarejestrowano ${data.length} slash commands na serwerze (widoczne natychmiast)!`);
  } catch (error) {
    console.error('❌ Błąd rejestracji slash commands:', error);
  }
}

client.once('ready', async () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);
  
  await registerSlashCommands();
  
  try {
    await transporter.verify();
    console.log('✅ SMTP OK');
  } catch (e) {
    console.error('❌ SMTP FAIL:', e);
  }

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error('❌ Bot nie jest na żadnym serwerze!');
    return;
  }

  const channel = guild.channels.cache.find(ch => ch.name === CHANNEL_NAME);
  if (!channel) {
    console.error(`❌ Nie znaleziono kanału #${CHANNEL_NAME}`);
    return;
  }

  const tracker = loadFormTracker();
  const formKey = `${guild.id}_${channel.id}`;
  
  if (tracker[formKey]) {
    console.log(`✅ Formularz już istnieje na kanale #${CHANNEL_NAME} - pomijam wysyłanie`);
    return;
  }

  const formButton = new ButtonBuilder()
    .setCustomId('open_stockx_form')
    .setLabel('📝 Wypełnij formularz zamówienia')
    .setStyle(ButtonStyle.Primary);

  const settingsButton = new ButtonBuilder()
    .setCustomId('open_user_settings')
    .setLabel('⚙️ Ustawienia')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(formButton, settingsButton);

  const sentMessage = await channel.send({
    content: '**📦 Generator Zamówień - Multi-Brand**\n\n✨ **Dostępne szablony:** StockX, Apple, Balenciaga, Bape, Dior, LV, Moncler, Nike, Stussy, Trapstar\n\nKliknij przycisk poniżej, aby wypełnić formularz zamówienia.\nUżyj przycisku "Ustawienia" aby zapisać swoje dane (imię, adres, email) - nie będziesz musiał wpisywać ich za każdym razem!',
    components: [row],
  });

  tracker[formKey] = {
    messageId: sentMessage.id,
    timestamp: new Date().toISOString()
  };
  saveFormTracker(tracker);

  console.log(`✅ Wysłano trwały formularz na kanał #${CHANNEL_NAME}`);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    if (message.channel.name === LINK_CHANNEL_NAME && message.attachments.size > 0) {
      message.attachments.forEach(attachment => {
        if (attachment.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          message.channel.send(`🔗 ${attachment.url}`);
        }
      });
    }

    if (message.content.startsWith('!echo ')) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ Tylko administratorzy mogą używać komendy !echo!');
      }

      const args = message.content.slice(6).trim();
      const channelMatch = args.match(/^<#(\d+)>\s+(.+)$/);
      
      if (!channelMatch) {
        return message.reply('❌ Użycie: `!echo #kanał wiadomość`');
      }

      const channelId = channelMatch[1];
      const content = channelMatch[2];
      
      const targetChannel = message.guild.channels.cache.get(channelId);
      if (!targetChannel) {
        return message.reply('❌ Nie znaleziono kanału!');
      }

      try {
        await targetChannel.send(content);
        await message.reply(`✅ Wysłano wiadomość na kanał ${targetChannel}`);
      } catch (err) {
        await message.reply('❌ Błąd wysyłania wiadomości!');
      }
    }

    if (message.content.startsWith('!setdays')) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ Tylko administratorzy mogą ustawiać dostęp czasowy!');
      }

      const args = message.content.split(/\s+/);
      if (args.length < 3) {
        return message.reply('❌ Użycie: `!setdays @użytkownik liczba_dni` lub `!setdays <ID> liczba_dni`');
      }

      let userId;
      if (message.mentions.users.size > 0) {
        userId = message.mentions.users.first().id;
      } else {
        userId = args[1];
      }

      const days = parseInt(args[2]);
      if (isNaN(days) || days < 1) {
        return message.reply('❌ Liczba dni musi być >= 1');
      }

      const expiryDate = setUserAccess(userId, days);
      const user = await client.users.fetch(userId).catch(() => null);
      const userName = user ? user.tag : userId;
      
      const dateStr = expiryDate.toLocaleDateString('pl-PL');
      await message.reply(`✅ Ustawiono dostęp dla **${userName}** na **${days}** dni (do ${dateStr})`);
      console.log(`✅ Admin ${message.author.tag} ustawił dostęp na ${days} dni dla ${userName}`);

      if (user) {
        try {
          await user.send(`📩 **Powiadomienie z serwera ${message.guild.name}**\n\n✅ Administrator **${message.author.tag}** dał Ci dostęp do formularza StockX na **${days}** dni.\n\nTwój dostęp wygasa: **${dateStr}**`);
        } catch (err) {
          console.log(`⚠️ Nie udało się wysłać DM do ${userName}`);
        }
      }
    }

    if (message.content.startsWith('!resettracker')) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ Tylko administratorzy mogą resetować tracker formularzy!');
      }

      saveFormTracker({});
      await message.reply('✅ Tracker formularzy został zresetowany! Bot wyśle formularz ponownie przy następnym uruchomieniu.');
      console.log(`✅ Admin ${message.author.tag} zresetował tracker formularzy`);
    }

  } catch (err) {
    console.error('❌ Błąd komendy:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setlimit') {
        const targetUser = interaction.options.getUser('użytkownik');
        const limit = interaction.options.getInteger('liczba');

        setUserLimit(targetUser.id, limit);
        
        await interaction.reply({
          content: `✅ Ustawiono limit dla **${targetUser.tag}**: **${limit}** użyć`,
          ephemeral: true
        });
        
        console.log(`✅ Admin ${interaction.user.tag} ustawił limit ${limit} dla ${targetUser.tag}`);

        try {
          await targetUser.send(`📩 **Powiadomienie z serwera ${interaction.guild.name}**\n\n✅ Administrator **${interaction.user.tag}** ustawił Ci limit użyć formularza StockX: **${limit}** ${limit === 1 ? 'użycie' : 'użyć'}.\n\nMożesz teraz wypełnić formularz **${limit}** razy.`);
        } catch (err) {
          console.log(`⚠️ Nie udało się wysłać DM do ${targetUser.tag}`);
        }
      }

      if (interaction.commandName === 'resetlimit') {
        const targetUser = interaction.options.getUser('użytkownik');

        const limits = loadLimits();
        const hadLimit = limits[targetUser.id] !== undefined;
        delete limits[targetUser.id];
        saveLimits(limits);

        await interaction.reply({
          content: `✅ Zresetowano limit dla **${targetUser.tag}** - teraz ma **nieograniczone** użycia!`,
          ephemeral: true
        });
        
        console.log(`✅ Admin ${interaction.user.tag} zresetował limit dla ${targetUser.tag}`);

        if (hadLimit) {
          try {
            await targetUser.send(`📩 **Powiadomienie z serwera ${interaction.guild.name}**\n\n✅ Administrator **${interaction.user.tag}** zresetował Twój limit użyć formularza StockX.\n\nTeraz masz **nieograniczone** użycia! 🎉`);
          } catch (err) {
            console.log(`⚠️ Nie udało się wysłać DM do ${targetUser.tag}`);
          }
        }
      }

      if (interaction.commandName === 'resetlimits') {
        saveLimits({});
        
        await interaction.reply({
          content: '✅ Wszystkie limity zostały zresetowane - wszyscy mają teraz nieograniczone użycia!',
          ephemeral: true
        });
        
        console.log(`✅ Admin ${interaction.user.tag} zresetował wszystkie limity`);
      }

      if (interaction.commandName === 'checklimit') {
        const targetUser = interaction.options.getUser('użytkownik');
        const userId = targetUser ? targetUser.id : interaction.user.id;

        if (targetUser && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: '❌ Tylko administratorzy mogą sprawdzać limity innych użytkowników!',
            ephemeral: true
          });
        }

        const limit = getUserLimit(userId);
        const limitText = limit === -1 ? 'nieograniczone' : limit;
        const userName = targetUser ? targetUser.tag : 'Masz';

        const content = targetUser 
          ? `📊 **${userName}** ma jeszcze **${limitText}** użyć formularza.`
          : `📊 ${userName} jeszcze **${limitText}** użyć formularza.`;

        await interaction.reply({
          content,
          ephemeral: true
        });
      }

      if (interaction.commandName === 'grantaccess') {
        const targetUser = interaction.options.getUser('użytkownik');
        const days = interaction.options.getInteger('dni');

        const expiryDate = setUserAccess(targetUser.id, days);
        const dateStr = expiryDate.toLocaleDateString('pl-PL');

        await interaction.reply({
          content: `✅ Ustawiono dostęp dla **${targetUser.tag}** na **${days}** ${days === 1 ? 'dzień' : 'dni'} (do ${dateStr})`,
          ephemeral: true
        });

        console.log(`✅ Admin ${interaction.user.tag} ustawił dostęp na ${days} dni dla ${targetUser.tag}`);

        try {
          await targetUser.send(`📩 **Powiadomienie z serwera ${interaction.guild.name}**\n\n✅ Administrator **${interaction.user.tag}** dał Ci dostęp do formularza na **${days}** ${days === 1 ? 'dzień' : 'dni'}.\n\nTwój dostęp wygasa: **${dateStr}**`);
        } catch (err) {
          console.log(`⚠️ Nie udało się wysłać DM do ${targetUser.tag}`);
        }
      }

      if (interaction.commandName === 'checkaccess') {
        const targetUser = interaction.options.getUser('użytkownik');
        const userId = targetUser ? targetUser.id : interaction.user.id;

        if (targetUser && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: '❌ Tylko administratorzy mogą sprawdzać dostęp innych użytkowników!',
            ephemeral: true
          });
        }

        const accessInfo = checkUserAccess(userId);
        const userName = targetUser ? targetUser.tag : 'Masz';

        if (accessInfo.unlimited) {
          const content = targetUser 
            ? `📅 **${userName}** ma **nieograniczony** dostęp do formularza.`
            : `📅 ${userName} **nieograniczony** dostęp do formularza.`;
          
          return interaction.reply({
            content,
            ephemeral: true
          });
        }

        if (accessInfo.expired) {
          const dateStr = accessInfo.expiryDate.toLocaleDateString('pl-PL');
          const content = targetUser 
            ? `⏰ Dostęp dla **${userName}** wygasł **${dateStr}**`
            : `⏰ Twój dostęp wygasł **${dateStr}**`;
          
          return interaction.reply({
            content,
            ephemeral: true
          });
        }

        const now = new Date();
        const daysLeft = Math.ceil((accessInfo.expiryDate - now) / (1000 * 60 * 60 * 24));
        const dateStr = accessInfo.expiryDate.toLocaleDateString('pl-PL');
        
        const content = targetUser 
          ? `📅 **${userName}** ma jeszcze **${daysLeft}** ${daysLeft === 1 ? 'dzień' : 'dni'} dostępu (do ${dateStr})`
          : `📅 ${userName} jeszcze **${daysLeft}** ${daysLeft === 1 ? 'dzień' : 'dni'} dostępu (do ${dateStr})`;

        await interaction.reply({
          content,
          ephemeral: true
        });
      }
    }

    if (interaction.isButton() && interaction.customId === 'open_user_settings') {
      try {
        const modal = new ModalBuilder()
          .setCustomId('settings_modal_1')
          .setTitle('Ustawienia - Część 1/2');

        const nameInput = new TextInputBuilder()
          .setCustomId('full_name')
          .setLabel('Imię i Nazwisko')
          .setPlaceholder('np. Jan Kowalski')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const emailInput = new TextInputBuilder()
          .setCustomId('user_email')
          .setLabel('Adres Email')
          .setPlaceholder('np. jan@example.com')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const streetInput = new TextInputBuilder()
          .setCustomId('street')
          .setLabel('Ulica i Numer')
          .setPlaceholder('np. ul. Marszałkowska 123/45')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const cityInput = new TextInputBuilder()
          .setCustomId('city')
          .setLabel('Miasto')
          .setPlaceholder('np. Warszawa')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const postalInput = new TextInputBuilder()
          .setCustomId('postal_code')
          .setLabel('Kod Pocztowy')
          .setPlaceholder('np. 00-001')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(emailInput),
          new ActionRowBuilder().addComponents(streetInput),
          new ActionRowBuilder().addComponents(cityInput),
          new ActionRowBuilder().addComponents(postalInput)
        );
        
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Błąd przy otwieraniu ustawień:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Nie mogę otworzyć ustawień. Usuń starą wiadomość i zrestartuj bota.',
            ephemeral: true
          }).catch(() => {});
        }
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'settings_modal_1') {
      await interaction.deferReply({ ephemeral: true });

      const fullName = interaction.fields.getTextInputValue('full_name');
      const email = interaction.fields.getTextInputValue('user_email');
      const street = interaction.fields.getTextInputValue('street');
      const city = interaction.fields.getTextInputValue('city');
      const postalCode = interaction.fields.getTextInputValue('postal_code');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return interaction.editReply({
          content: '❌ Podaj poprawny adres email!',
          ephemeral: true
        });
      }

      interaction.client.tempSettings = interaction.client.tempSettings || {};
      interaction.client.tempSettings[interaction.user.id] = {
        fullName, email, street, city, postalCode
      };

      await interaction.editReply({ 
        content: '✅ Wypełniono część 1/2. Wypełnij teraz część 2...', 
        ephemeral: true 
      });

      await interaction.followUp({ 
        content: '📝 Kliknij przycisk poniżej, aby kontynuować:', 
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('continue_settings')
              .setLabel('Kontynuuj ustawienia')
              .setStyle(ButtonStyle.Success)
          )
        ],
        ephemeral: true 
      });
    }

    if (interaction.isButton() && interaction.customId === 'continue_settings') {
      try {
        const tempSettings = interaction.client.tempSettings?.[interaction.user.id];
        if (!tempSettings) {
          return interaction.reply({ 
            content: '❌ Błąd: Nie znaleziono danych z części 1. Spróbuj ponownie.', 
            ephemeral: true 
          });
        }

        const modal = new ModalBuilder()
          .setCustomId('settings_modal_2')
          .setTitle('Ustawienia - Część 2/2');

        const countryInput = new TextInputBuilder()
          .setCustomId('country')
          .setLabel('Kraj')
          .setPlaceholder('np. Polska')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(countryInput));
        await interaction.showModal(modal);
      } catch (err) {
        console.error('❌ Błąd przy otwieraniu ustawień cz.2:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Wystąpił błąd. Spróbuj ponownie.',
            ephemeral: true
          }).catch(() => {});
        }
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'settings_modal_2') {
      const country = interaction.fields.getTextInputValue('country');

      const tempSettings = interaction.client.tempSettings?.[interaction.user.id];
      if (!tempSettings) {
        return interaction.reply({ 
          content: '❌ Błąd: Nie znaleziono danych z części 1. Spróbuj ponownie.', 
          ephemeral: true 
        });
      }

      const completeSettings = {
        ...tempSettings,
        country
      };

      setUserSettings(interaction.user.id, completeSettings);
      setUserEmail(interaction.user.id, completeSettings.email);

      delete interaction.client.tempSettings[interaction.user.id];

      console.log(`✅ Użytkownik ${interaction.user.tag} zapisał ustawienia:`, completeSettings);
      
      await interaction.reply({
        content: `✅ **Ustawienia zapisane!**\n\n👤 **Imię:** ${completeSettings.fullName}\n📧 **Email:** ${completeSettings.email}\n📍 **Adres:**\n${completeSettings.street}\n${completeSettings.city}, ${completeSettings.postalCode}\n${completeSettings.country}\n\nPrzy wypełnianiu formularzy te dane będą automatycznie użyte!`,
        ephemeral: true
      });
    }

    if (interaction.isButton() && interaction.customId === 'open_stockx_form') {
      await interaction.deferReply({ ephemeral: true });

      const accessStatus = checkUserAccess(interaction.user.id);
      
      if (!accessStatus.hasAccess) {
        const dateStr = accessStatus.expiryDate.toLocaleDateString('pl-PL');
        return interaction.editReply({
          content: `❌ **Twój dostęp czasowy wygasł!**\n\nTwój dostęp wygasł: ${dateStr}\nSkontaktuj się z administratorem, aby odnowić dostęp.`
        });
      }

      const userLimit = getUserLimit(interaction.user.id);
      
      if (userLimit === 0) {
        return interaction.editReply({
          content: '❌ **Brak dostępnych użyć!**\n\nWypełniłeś już maksymalną liczbę formularzy. Skontaktuj się z administratorem.'
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('template_select')
        .setPlaceholder('🎨 Wybierz szablon email')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('StockX')
            .setDescription('Szablon StockX z order tracking')
            .setValue('stockx')
            .setEmoji('📦'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Apple')
            .setDescription('Profesjonalny szablon Apple Store')
            .setValue('apple')
            .setEmoji('🍎'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Balenciaga')
            .setDescription('Elegancki szablon Balenciaga')
            .setValue('balenciaga')
            .setEmoji('👗'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Bape')
            .setDescription('Streetwear szablon Bape')
            .setValue('bape')
            .setEmoji('🦍'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Dior')
            .setDescription('Luksusowy szablon Dior')
            .setValue('dior')
            .setEmoji('💎'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Louis Vuitton')
            .setDescription('Premium szablon LV')
            .setValue('lv')
            .setEmoji('👜'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Moncler')
            .setDescription('Szablon Moncler outerwear')
            .setValue('moncler')
            .setEmoji('🧥'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Nike')
            .setDescription('Sportowy szablon Nike')
            .setValue('nike')
            .setEmoji('👟'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Stussy')
            .setDescription('Streetwear szablon Stussy')
            .setValue('stussy')
            .setEmoji('🎨'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Trapstar')
            .setDescription('Urban szablon Trapstar')
            .setValue('trapstar')
            .setEmoji('⭐')
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.editReply({
        content: '**📧 Wybierz szablon email dla zamówienia**\n\nWybierz markę z listy poniżej, aby wypełnić formularz zamówienia.',
        components: [row]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'template_select') {
      try {
        const template = interaction.values[0];
        
        interaction.client.tempData = interaction.client.tempData || {};
        interaction.client.tempData[interaction.user.id] = { template };

        const modal = new ModalBuilder()
          .setCustomId('stockx_modal')
          .setTitle(`Formularz ${template.toUpperCase()} - Część 1/2`);

        const brandInput = new TextInputBuilder()
          .setCustomId('brand')
          .setLabel('Marka')
          .setPlaceholder('np. Nike')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const productInput = new TextInputBuilder()
          .setCustomId('product')
          .setLabel('Nazwa Produktu')
          .setPlaceholder('np. Air Jordan 1 Retro High')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const sizeInput = new TextInputBuilder()
          .setCustomId('size')
          .setLabel('Rozmiar (opcjonalnie dla Apple)')
          .setPlaceholder('np. 42 lub US 10 (zostaw puste dla Apple)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const priceInput = new TextInputBuilder()
          .setCustomId('price')
          .setLabel('Cena (tylko liczba, bez $)')
          .setPlaceholder('np. 250.00')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(brandInput);
        const row2 = new ActionRowBuilder().addComponents(productInput);
        const row3 = new ActionRowBuilder().addComponents(sizeInput);
        const row4 = new ActionRowBuilder().addComponents(priceInput);

        modal.addComponents(row1, row2, row3, row4);
        await interaction.showModal(modal);
      } catch (error) {
        console.error('❌ Błąd przy pokazywaniu modala:', error);
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({ 
              content: '❌ Wystąpił błąd. Spróbuj ponownie.', 
              ephemeral: true 
            });
          } catch (e) {
            console.error('Nie udało się odpowiedzieć na interakcję:', e);
          }
        }
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'stockx_modal') {
      await interaction.deferReply({ ephemeral: true });

      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData || !tempData.template) {
        await interaction.editReply({ 
          content: '❌ Błąd: Nie znaleziono wybranego szablonu. Spróbuj ponownie.', 
          ephemeral: true 
        });
        return;
      }

      const template = tempData.template;
      const brand = interaction.fields.getTextInputValue('brand');
      const product = interaction.fields.getTextInputValue('product');
      const size = interaction.fields.getTextInputValue('size') || '';
      const priceRaw = interaction.fields.getTextInputValue('price').trim();

      interaction.client.tempData[interaction.user.id] = {
        template, brand, product, size, priceRaw
      };

      await interaction.editReply({ 
        content: '✅ Wypełniono część 1/2. Wypełnij teraz część 2...', 
        ephemeral: true 
      });

      await interaction.followUp({ 
        content: '📝 Kliknij przycisk poniżej, aby kontynuować:', 
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('continue_form')
              .setLabel('Kontynuuj formularz')
              .setStyle(ButtonStyle.Success)
          )
        ],
        ephemeral: true 
      });
    }

    if (interaction.isButton() && interaction.customId === 'continue_form') {
      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData) {
        return interaction.reply({ 
          content: '❌ Błąd: Nie znaleziono danych z części 1. Spróbuj ponownie.', 
          ephemeral: true 
        });
      }

      const template = tempData.template;
      const config = TEMPLATE_CONFIG[template];

      const modal = new ModalBuilder()
        .setCustomId('stockx_modal_2')
        .setTitle('Formularz - Część 2/2');

      const savedEmail = getUserEmail(interaction.user.id);

      const emailInput = new TextInputBuilder()
        .setCustomId('email')
        .setLabel('Email')
        .setPlaceholder('np. klient@example.com')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      if (savedEmail) {
        emailInput.setValue(savedEmail);
      }

      const dateInput = new TextInputBuilder()
        .setCustomId('date')
        .setLabel('Data (np. 22/12/2024)')
        .setPlaceholder('np. 22/12/2024')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const imageInput = new TextInputBuilder()
        .setCustomId('image_url')
        .setLabel('🌐 Link do Zdjęcia (PUBLICZNY URL!)')
        .setPlaceholder('https://i.imgur.com/abc123.jpg')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const rows = [
        new ActionRowBuilder().addComponents(emailInput),
        new ActionRowBuilder().addComponents(dateInput),
        new ActionRowBuilder().addComponents(imageInput)
      ];

      if (config.needsStyleId && rows.length < 5) {
        const styleIdInput = new TextInputBuilder()
          .setCustomId('style_id')
          .setLabel('Style ID')
          .setPlaceholder('np. DZ5485-612')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(styleIdInput));
      }

      if (config.needsColour && rows.length < 5) {
        const colourInput = new TextInputBuilder()
          .setCustomId('colour')
          .setLabel('Kolor')
          .setPlaceholder('np. Czarny, Biały')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(colourInput));
      }

      if (config.needsTaxes && rows.length < 5) {
        const taxesInput = new TextInputBuilder()
          .setCustomId('taxes')
          .setLabel('Podatki (tylko liczba, bez $)')
          .setPlaceholder('np. 15.00')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(taxesInput));
      }

      if (config.needsReference && rows.length < 5) {
        const referenceInput = new TextInputBuilder()
          .setCustomId('reference')
          .setLabel('Numer Referencyjny')
          .setPlaceholder('np. REF123456')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(referenceInput));
      }

      if (config.needsFirstName && rows.length < 5) {
        const firstNameInput = new TextInputBuilder()
          .setCustomId('first_name')
          .setLabel('Imię')
          .setPlaceholder('np. Jan')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(firstNameInput));
      }

      if (config.needsWholeName && rows.length < 5) {
        const wholeNameInput = new TextInputBuilder()
          .setCustomId('whole_name')
          .setLabel('Pełne Imię i Nazwisko')
          .setPlaceholder('np. Jan Kowalski')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(wholeNameInput));
      }

      if (config.needsQuantity && rows.length < 5) {
        const quantityInput = new TextInputBuilder()
          .setCustomId('quantity')
          .setLabel('Ilość')
          .setPlaceholder('np. 1')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue('1');
        rows.push(new ActionRowBuilder().addComponents(quantityInput));
      }

      if (config.needsCurrency && rows.length < 5 && !config.needsModal3) {
        const currencyInput = new TextInputBuilder()
          .setCustomId('currency')
          .setLabel('Waluta (np. USD, EUR, GBP)')
          .setPlaceholder('np. USD')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue('USD');
        rows.push(new ActionRowBuilder().addComponents(currencyInput));
      }

      if (config.needsPhoneNumber && rows.length < 5 && !config.needsModal3) {
        const phoneInput = new TextInputBuilder()
          .setCustomId('phone_number')
          .setLabel('Numer Telefonu')
          .setPlaceholder('np. +48 123 456 789')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(phoneInput));
      }

      if (config.needsCardEnd && rows.length < 5 && !config.needsModal3) {
        const cardEndInput = new TextInputBuilder()
          .setCustomId('card_end')
          .setLabel('Ostatnie 4 cyfry karty')
          .setPlaceholder('np. 1234')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(cardEndInput));
      }

      if (config.needsEstimatedDelivery && rows.length < 5 && !config.needsModal3) {
        const deliveryInput = new TextInputBuilder()
          .setCustomId('estimated_delivery')
          .setLabel('Szacowana Data Dostawy')
          .setPlaceholder('np. 25/12/2024')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(deliveryInput));
      }

      modal.addComponents(...rows);
      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'stockx_modal_2') {
      await interaction.deferReply({ ephemeral: true });

      const email = interaction.fields.getTextInputValue('email');
      const orderDate = interaction.fields.getTextInputValue('date');
      const imageURL = interaction.fields.getTextInputValue('image_url').trim();

      if (!imageURL.startsWith('https://') && !imageURL.startsWith('http://')) {
        return interaction.editReply({
          content: '❌ **Link do zdjęcia musi być publicznym URL!**\n\n✅ Prawidłowy przykład:\n`https://i.imgur.com/abc123.jpg`\n\n❌ NIE używaj:\n- Lokalnych plików (C:\\zdjecie.jpg)\n- Replit dev URL\n- Linków bez https://\n\n💡 **Prześlij zdjęcie na Imgur.com i skopiuj link!**',
          ephemeral: true
        });
      }

      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData) {
        await interaction.editReply({ 
          content: '❌ Błąd: Nie znaleziono danych z części 1. Spróbuj ponownie.', 
          ephemeral: true 
        });
        return;
      }

      const { template, brand, product, size, priceRaw } = tempData;

      const config = TEMPLATE_CONFIG[template];
      
      console.log(`🔍 DEBUGOWANIE CENY:`);
      console.log(`   Oryginalna wartość: "${priceRaw}"`);
      console.log(`   Typ: ${typeof priceRaw}`);
      console.log(`   Długość: ${priceRaw.length}`);
      
      const cleanPrice = priceRaw.replace(/[^\d.,]/g, '').replace(',', '.');
      console.log(`   Po czyszczeniu: "${cleanPrice}"`);
      
      const price = Number(cleanPrice);
      console.log(`   Skonwertowana liczba: ${price}`);
      console.log(`   isNaN: ${isNaN(price)}`);
      console.log(`   price <= 0: ${price <= 0}`);
      
      if (!priceRaw || isNaN(price) || price <= 0) {
        await interaction.editReply({ 
          content: `❌ **Błąd: Nieprawidłowa cena!**\n\nWpisałeś: "${priceRaw}"\nPo czyszczeniu: "${cleanPrice}"\nLiczba: ${price}\n\n✅ Prawidłowy format:\n- 200\n- 250.50\n- 1500\n\n❌ NIE używaj:\n- Symbolu $ (tylko liczba)\n- Liter lub innych znaków`, 
          ephemeral: true 
        });
        return;
      }
      
      console.log(`✅ Cena zaakceptowana: $${price}`);

      const styleId = config.needsStyleId ? interaction.fields.getTextInputValue('style_id') : '';
      const colour = config.needsColour ? interaction.fields.getTextInputValue('colour') : '';
      const taxesRaw = config.needsTaxes ? interaction.fields.getTextInputValue('taxes') : '0';
      const reference = config.needsReference ? interaction.fields.getTextInputValue('reference') : '';
      const firstName = config.needsFirstName ? interaction.fields.getTextInputValue('first_name') : '';
      const wholeName = config.needsWholeName ? interaction.fields.getTextInputValue('whole_name') : '';
      const quantityRaw = config.needsQuantity ? interaction.fields.getTextInputValue('quantity') : '1';
      const currency = config.needsCurrency && !config.needsModal3 ? interaction.fields.getTextInputValue('currency') : 'USD';
      const phoneNumber = config.needsPhoneNumber && !config.needsModal3 ? interaction.fields.getTextInputValue('phone_number') : '';
      const cardEnd = config.needsCardEnd && !config.needsModal3 ? interaction.fields.getTextInputValue('card_end') : '';
      const estimatedDelivery = config.needsEstimatedDelivery && !config.needsModal3 ? interaction.fields.getTextInputValue('estimated_delivery') : '';

      const taxes = Number(taxesRaw);
      if (isNaN(taxes)) {
        await interaction.editReply({ 
          content: '❌ Błąd: Podatki muszą być liczbą!', 
          ephemeral: true 
        });
        return;
      }

      const quantity = Number(quantityRaw);

      if (config.needsModal3) {
        interaction.client.tempData[interaction.user.id] = {
          ...tempData,
          email,
          orderDate,
          imageURL,
          styleId,
          colour,
          taxesRaw,
          taxes,
          reference,
          firstName,
          wholeName,
          quantityRaw,
          quantity,
          price
        };

        await interaction.editReply({
          content: '📝 Kliknij przycisk poniżej, aby wypełnić ostatnią część formularza:', 
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('continue_modal3')
                .setLabel('Kontynuuj - Część 3/3')
                .setStyle(ButtonStyle.Success)
            )
          ],
          ephemeral: true 
        });
        return;
      }

      delete interaction.client.tempData[interaction.user.id];
      if (isNaN(quantity) || quantity < 1) {
        await interaction.editReply({ 
          content: '❌ Błąd: Ilość musi być liczbą większą od 0!', 
          ephemeral: true 
        });
        return;
      }

      const processingFee = 5.95;
      const shipping = 12.95;
      const subtotal = price * quantity;
      const total = (subtotal + processingFee + shipping + taxes).toFixed(2);
      const orderNumber = String(Date.now());

      console.log(`📧 [${template}] Generating email with:`, {
        price: `$${price.toFixed(2)}`,
        quantity,
        subtotal: `$${subtotal.toFixed(2)}`,
        total: `$${total}`,
        productQty: `Qty ${quantity}`
      });

      const userSettings = getUserSettings(interaction.user.id);

      let html = readTpl(config.file);
      
      html = html
        .replace(/PRODUCT_IMAGE/g, esc(imageURL))
        .replace(/PRODUCT_LINK/g, esc(imageURL))
        .replace(/PRODUCT_NAME/g, esc(`${brand} ${product}`))
        .replace(/PRODUCTNAME/g, esc(`${brand} ${product}`))
        .replace(/PRODUCT_SUBTOTAL/g, esc(`$${subtotal.toFixed(2)}`))
        .replace(/PRODUCT_QTY/g, esc(`Qty ${quantity}`))
        .replace(/PRODUCT_PRICE/g, esc(`$${price.toFixed(2)}`))
        .replace(/PRODUCTPRICE/g, esc(`$${price.toFixed(2)}`))
        .replace(/PRODUCT_COLOUR/g, esc(colour))
        .replace(/PRODUCTSTYLE/g, esc(styleId))
        .replace(/PRODUCTSIZE/g, esc(size))
        .replace(/PRODUCT/g, esc(product))
        .replace(/STYLE_ID/g, esc(styleId))
        .replace(/\bSTYLE\b/g, esc(styleId))
        .replace(/\bSIZE\b/g, esc(size))
        .replace(/\bPRICE\b/g, esc(`$${price.toFixed(2)}`))
        .replace(/\bFEE\b/g, esc(`$${processingFee.toFixed(2)}`))
        .replace(/\bSHIPPING\b/g, esc(`$${shipping.toFixed(2)}`))
        .replace(/\bTAXES\b/g, esc(`$${taxes.toFixed(2)}`))
        .replace(/TOTAL\*/g, esc(`$${total}*`))
        .replace(/\bTOTAL\b/g, esc(`$${total}`))
        .replace(/ORDER_TOTAL/g, esc(`$${total}`))
        .replace(/CARTTOTAL/g, esc(`$${total}`))
        .replace(/\bDATE\b/g, esc(orderDate))
        .replace(/ORDERDATE/g, esc(orderDate))
        .replace(/ORDER_NUMBER/g, esc(orderNumber))
        .replace(/ORDERNUMBER/g, esc(orderNumber))
        .replace(/\bCOLOUR\b/g, esc(colour))
        .replace(/\bREFERENCE\b/g, esc(reference))
        .replace(/\bFIRSTNAME\b/g, esc(userSettings?.fullName || firstName || 'Jan'))
        .replace(/FIRST_NAME/g, esc(userSettings?.fullName || firstName || 'Jan'))
        .replace(/WHOLE_NAME/g, esc(userSettings?.fullName || wholeName || 'Jan Kowalski'))
        .replace(/WHOLENAME/g, esc(userSettings?.fullName || wholeName || 'Jan Kowalski'))
        .replace(/\bEMAIL\b/g, esc(email))
        .replace(/\bQUANTITY\b/g, esc(quantity))
        .replace(/CURRENCY_STR/g, esc(currency))
        .replace(/\bCURRENCY\b/g, esc(currency))
        .replace(/PHONE_NUMBER/g, esc(phoneNumber || userSettings?.email || '+1 234 567 890'))
        .replace(/CARD_END/g, esc(cardEnd || '1234'))
        .replace(/ESTIMATED_DELIVERY/g, esc(estimatedDelivery))
        .replace(/ADDRESS1/g, esc(userSettings?.fullName || firstName || wholeName || 'Customer'))
        .replace(/ADDRESS2/g, esc(userSettings?.street || 'Shipping Address Line 1'))
        .replace(/ADDRESS3/g, esc(userSettings ? `${userSettings.city}, ${userSettings.postalCode}` : 'City, Postal Code'))
        .replace(/ADDRESS4/g, esc(userSettings?.country || 'Country'))
        .replace(/ADDRESS5/g, '')
        .replace(/BILLING1/g, esc(userSettings?.fullName || wholeName || firstName || 'Customer'))
        .replace(/BILLING2/g, esc(userSettings?.street || 'Billing Address Line 1'))
        .replace(/BILLING3/g, esc(userSettings ? `${userSettings.city}, ${userSettings.postalCode}` : 'City, Postal Code'))
        .replace(/BILLING4/g, esc(userSettings?.country || 'Country'))
        .replace(/BILLING5/g, '')
        .replace(/SHIPPING1/g, esc(userSettings?.fullName || firstName || wholeName || 'Customer'))
        .replace(/SHIPPING2/g, esc(userSettings?.street || 'Shipping Address Line 1'))
        .replace(/SHIPPING3/g, esc(userSettings ? `${userSettings.city}, ${userSettings.postalCode}` : 'City, Postal Code'))
        .replace(/SHIPPING4/g, esc(userSettings?.country || 'Country'))
        .replace(/SHIPPING5/g, '')
        .replace(/SHIPPING_JAN/g, esc(userSettings?.fullName || firstName || wholeName || 'Jan Kowalski'))
        .replace(/BILLING_JAN/g, esc(userSettings?.fullName || wholeName || firstName || 'Jan Kowalski'));

      const brandName = template.charAt(0).toUpperCase() + template.slice(1);
      const info = await transporter.sendMail({
        from: `"${brandName}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `${brandName} — ${brand} ${product} (${size})`,
        html,
      });

      const remainingUses = decreaseUserLimit(interaction.user.id);
      const remainingText = remainingUses === -1 ? 'nieograniczone' : remainingUses;

      console.log(`✅ Wysłano email [${template}]: ${info.messageId} | Użytkownik: ${interaction.user.tag} | Pozostało: ${remainingText}`);
      
      await interaction.editReply({ 
        content: `✅ **Zamówienie wysłane pomyślnie!**\n\n**Szablon:** ${brandName}\n**Email:** ${email}\n**Produkt:** ${brand} ${product}\n**Rozmiar:** ${size}\n**Cena całkowita:** $${total}\n\n📊 **Pozostałe użycia: ${remainingText}**`, 
        ephemeral: true 
      });
    }

    if (interaction.isButton() && interaction.customId === 'continue_modal3') {
      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData) {
        return interaction.reply({ 
          content: '❌ Błąd: Nie znaleziono danych z części 2. Spróbuj ponownie.', 
          ephemeral: true 
        });
      }

      const template = tempData.template;
      const config = TEMPLATE_CONFIG[template];

      const modal = new ModalBuilder()
        .setCustomId('stockx_modal_3')
        .setTitle('Formularz - Część 3/3');

      const rows = [];

      if (config.needsCurrency && rows.length < 5) {
        const currencyInput = new TextInputBuilder()
          .setCustomId('currency')
          .setLabel('Waluta (np. USD, EUR, GBP)')
          .setPlaceholder('np. USD')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue('USD');
        rows.push(new ActionRowBuilder().addComponents(currencyInput));
      }

      if (config.needsCardEnd && rows.length < 5) {
        const cardEndInput = new TextInputBuilder()
          .setCustomId('card_end')
          .setLabel('Ostatnie 4 cyfry karty')
          .setPlaceholder('np. 1234')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(cardEndInput));
      }

      if (config.needsEstimatedDelivery && rows.length < 5) {
        const deliveryInput = new TextInputBuilder()
          .setCustomId('estimated_delivery')
          .setLabel('Szacowana Data Dostawy')
          .setPlaceholder('np. 25/12/2024')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(deliveryInput));
      }

      modal.addComponents(...rows);
      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'stockx_modal_3') {
      await interaction.deferReply({ ephemeral: true });

      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData) {
        await interaction.editReply({ 
          content: '❌ Błąd: Nie znaleziono danych z poprzednich części. Spróbuj ponownie.', 
          ephemeral: true 
        });
        return;
      }

      const { template, brand, product, size, email, orderDate, imageURL, styleId, colour, taxes, reference, firstName, wholeName, quantity, price } = tempData;
      delete interaction.client.tempData[interaction.user.id];

      const config = TEMPLATE_CONFIG[template];

      const currency = config.needsCurrency ? interaction.fields.getTextInputValue('currency') : 'USD';
      const cardEnd = config.needsCardEnd ? interaction.fields.getTextInputValue('card_end') : '';
      const estimatedDelivery = config.needsEstimatedDelivery ? interaction.fields.getTextInputValue('estimated_delivery') : '';

      const processingFee = 5.95;
      const shipping = 12.95;
      const subtotal = price * quantity;
      const total = (subtotal + processingFee + shipping + taxes).toFixed(2);
      const orderNumber = String(Date.now());

      console.log(`📧 [${template}] Generating email with modal3 data:`, {
        price: `$${price.toFixed(2)}`,
        quantity,
        subtotal: `$${subtotal.toFixed(2)}`,
        total: `$${total}`,
        currency,
        cardEnd,
        estimatedDelivery
      });

      const userSettings = getUserSettings(interaction.user.id);
      let html = readTpl(config.file);
      
      html = html
        .replace(/PRODUCT_IMAGE/g, esc(imageURL))
        .replace(/PRODUCT_LINK/g, esc(imageURL))
        .replace(/PRODUCT_NAME/g, esc(`${brand} ${product}`))
        .replace(/PRODUCTNAME/g, esc(`${brand} ${product}`))
        .replace(/PRODUCT_SUBTOTAL/g, esc(`$${subtotal.toFixed(2)}`))
        .replace(/PRODUCT_QTY/g, esc(`Qty ${quantity}`))
        .replace(/PRODUCT_PRICE/g, esc(`$${price.toFixed(2)}`))
        .replace(/PRODUCTPRICE/g, esc(`$${price.toFixed(2)}`))
        .replace(/PRODUCT_COLOUR/g, esc(colour))
        .replace(/PRODUCTSTYLE/g, esc(styleId))
        .replace(/PRODUCTSIZE/g, esc(size))
        .replace(/PRODUCT/g, esc(product))
        .replace(/STYLE_ID/g, esc(styleId))
        .replace(/\bSTYLE\b/g, esc(styleId))
        .replace(/\bSIZE\b/g, esc(size))
        .replace(/\bPRICE\b/g, esc(`$${price.toFixed(2)}`))
        .replace(/\bFEE\b/g, esc(`$${processingFee.toFixed(2)}`))
        .replace(/\bSHIPPING\b/g, esc(`$${shipping.toFixed(2)}`))
        .replace(/\bTAXES\b/g, esc(`$${taxes.toFixed(2)}`))
        .replace(/TOTAL\*/g, esc(`$${total}*`))
        .replace(/\bTOTAL\b/g, esc(`$${total}`))
        .replace(/ORDER_TOTAL/g, esc(`$${total}`))
        .replace(/CARTTOTAL/g, esc(`$${total}`))
        .replace(/\bDATE\b/g, esc(orderDate))
        .replace(/ORDERDATE/g, esc(orderDate))
        .replace(/ORDER_NUMBER/g, esc(orderNumber))
        .replace(/ORDERNUMBER/g, esc(orderNumber))
        .replace(/\bCOLOUR\b/g, esc(colour))
        .replace(/\bREFERENCE\b/g, esc(reference))
        .replace(/\bFIRSTNAME\b/g, esc(userSettings?.fullName || firstName || 'Jan'))
        .replace(/FIRST_NAME/g, esc(userSettings?.fullName || firstName || 'Jan'))
        .replace(/WHOLE_NAME/g, esc(userSettings?.fullName || wholeName || 'Jan Kowalski'))
        .replace(/WHOLENAME/g, esc(userSettings?.fullName || wholeName || 'Jan Kowalski'))
        .replace(/\bEMAIL\b/g, esc(email))
        .replace(/\bQUANTITY\b/g, esc(quantity))
        .replace(/CURRENCY_STR/g, esc(currency))
        .replace(/\bCURRENCY\b/g, esc(currency))
        .replace(/PHONE_NUMBER/g, esc(userSettings?.email || '+1 234 567 890'))
        .replace(/CARD_END/g, esc(cardEnd || '1234'))
        .replace(/ESTIMATED_DELIVERY/g, esc(estimatedDelivery))
        .replace(/ADDRESS1/g, esc(userSettings?.fullName || firstName || wholeName || 'Customer'))
        .replace(/ADDRESS2/g, esc(userSettings?.street || 'Shipping Address Line 1'))
        .replace(/ADDRESS3/g, esc(userSettings ? `${userSettings.city}, ${userSettings.postalCode}` : 'City, Postal Code'))
        .replace(/ADDRESS4/g, esc(userSettings?.country || 'Country'))
        .replace(/ADDRESS5/g, '')
        .replace(/BILLING1/g, esc(userSettings?.fullName || wholeName || firstName || 'Customer'))
        .replace(/BILLING2/g, esc(userSettings?.street || 'Billing Address Line 1'))
        .replace(/BILLING3/g, esc(userSettings ? `${userSettings.city}, ${userSettings.postalCode}` : 'City, Postal Code'))
        .replace(/BILLING4/g, esc(userSettings?.country || 'Country'))
        .replace(/BILLING5/g, '')
        .replace(/SHIPPING1/g, esc(userSettings?.fullName || firstName || wholeName || 'Customer'))
        .replace(/SHIPPING2/g, esc(userSettings?.street || 'Shipping Address Line 1'))
        .replace(/SHIPPING3/g, esc(userSettings ? `${userSettings.city}, ${userSettings.postalCode}` : 'City, Postal Code'))
        .replace(/SHIPPING4/g, esc(userSettings?.country || 'Country'))
        .replace(/SHIPPING5/g, '')
        .replace(/SHIPPING_JAN/g, esc(userSettings?.fullName || firstName || wholeName || 'Jan Kowalski'))
        .replace(/BILLING_JAN/g, esc(userSettings?.fullName || wholeName || firstName || 'Jan Kowalski'));

      const brandName = template.charAt(0).toUpperCase() + template.slice(1);
      const info = await transporter.sendMail({
        from: `"${brandName}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `${brandName} — ${brand} ${product} (${size})`,
        html,
      });

      const remainingUses = decreaseUserLimit(interaction.user.id);
      const remainingText = remainingUses === -1 ? 'nieograniczone' : remainingUses;

      console.log(`✅ Wysłano email [${template}]: ${info.messageId} | Użytkownik: ${interaction.user.tag} | Pozostało: ${remainingText}`);
      
      await interaction.editReply({ 
        content: `✅ **Zamówienie wysłane pomyślnie!**\n\n**Szablon:** ${brandName}\n**Email:** ${email}\n**Produkt:** ${brand} ${product}\n**Rozmiar:** ${size}\n**Cena całkowita:** $${total}\n\n📊 **Pozostałe użycia: ${remainingText}**`, 
        ephemeral: true 
      });
    }
  } catch (err) {
    console.error('❌ Błąd interakcji:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ 
          content: '❌ Wystąpił błąd podczas przetwarzania formularza.', 
          ephemeral: true 
        }).catch(() => {});
      } else {
        await interaction.reply({ 
          content: '❌ Wystąpił błąd podczas przetwarzania formularza.', 
          ephemeral: true 
        }).catch(() => {});
      }
    } catch (replyErr) {
      console.error('❌ Nie można wysłać odpowiedzi o błędzie:', replyErr.message);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
