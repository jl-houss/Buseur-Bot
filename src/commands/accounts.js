const { SlashCommandBuilder } = require("@discordjs/builders");
const db = require('better-sqlite3')('./main.db');
const { EmbedBuilder } = require('discord.js');
const { get_cookie, get_buses } = require("../utils/functions");

const Green = 0x57F287
const Red = 0xED4245
const Yellow = 0xFFFF00
const Blue = 0x3498DB

async function account_add(interaction) {
    const username = interaction.options.getString('username')
    const password = interaction.options.getString('password')
    const elevage_id = interaction.options.getString('elevage-id')

    let account = await db.prepare('SELECT id, elevageId FROM accounts WHERE username = ?').get(username);

    if (account) {
        const embed = new EmbedBuilder()
            .setColor(Red)
            .setTitle("Ce compte existe déja !");

        await interaction.reply({ embeds: [embed], ephemeral: true })
        return
    }

    await interaction.deferReply({ ephemeral: true })

    if (!await get_cookie(username, password)) {
        const embed = new EmbedBuilder()
            .setColor(Red)
            .setTitle("Nom d'utilisateur et/ou mot de passe incorrectes !");

        await interaction.editReply({ embeds: [embed] })
        return
    }

    let buses = await get_buses(username, password, elevage_id)

    if (!buses) {
        const embed = new EmbedBuilder()
            .setColor(Red)
            .setTitle("L'identifiant de l'elevage est incorrect !");
        await interaction.editReply({ embeds: [embed] })
        return
    }

    await db.prepare("INSERT INTO accounts (username, password, elevageId) VALUES (?,?,?)").run(username, password, elevage_id)

    const embed = new EmbedBuilder()
        .setColor(Green)
        .setTitle("Compte ajouté !")
        .setDescription(`Le compte **\`${username}\`** a été ajouté.`);
    await interaction.editReply({ embeds: [embed] })

}

async function account_edit(interaction) {
    const username = interaction.options.getString('username')
    const new_username = interaction.options.getString('new-username')
    const new_password = interaction.options.getString('new-password')
    const new_elevage_id = interaction.options.getString('new-elevage-id')

    let account = await db.prepare('SELECT * FROM accounts WHERE username = ?').get(username)

    if (!new_username && !new_password && !new_elevage_id) {
        const embed = new EmbedBuilder()
            .setColor(Red)
            .setTitle("Veuillez renseignez au moins un nouveau nom d'utilisateur, mot de passe ou élevage !")
        await interaction.reply({ embeds: [embed], ephemeral: true })
        return
    }

    if (!account) {
        {
            const embed = new EmbedBuilder()
                .setColor(Red)
                .setTitle("Ce compte n'existe pas !")
                .setDescription(`Le compte **${username}** n'existe pas`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return
        }
    }

    let newaccount = await db.prepare('SELECT id FROM accounts WHERE username = ?').get(new_username)

    if (newaccount) {
        {
            const embed = new EmbedBuilder()
                .setColor(Red)
                .setTitle("Le nouveau nom d'utilisateur existe déja !")
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return
        }
    }

    await interaction.deferReply({ ephemeral: true })

    if (new_username && new_password) {

        if (await get_cookie(new_username, new_password)) {
            await db.prepare("UPDATE accounts SET username = ?, password = ? WHERE id = ?").run(new_username, new_password, account.id)
        } else {
            const embed = new EmbedBuilder()
                .setColor(Red)
                .setTitle("Nom d'utilisateur et/ou mot de passe incorrectes !")
            await interaction.editReply({ embeds: [embed] })
            return
        }

    } else if (new_username) {

        if (await get_cookie(new_username, account.password)) {
            await db.prepare("UPDATE accounts SET username = ? WHERE id = ?").run(new_username, account.id)
        } else {
            const embed = new EmbedBuilder()
                .setColor(Red)
                .setTitle("Nom d'utilisateur incorrect !")
            await interaction.editReply({ embeds: [embed] })
            return
        }
    } else if (new_password) {

        if (await get_cookie(account.username, new_password)) {
            await db.prepare("UPDATE accounts SET password = ? WHERE id = ?").run(new_password, account.id)
        } else {
            const embed = new EmbedBuilder()
                .setColor(Red)
                .setTitle("Mot de passe incorrect !")
            await interaction.editReply({ embeds: [embed] })
            return
        }
    }

    account = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(account.id)

    if (new_elevage_id) {
        let new_buses = await get_buses(account.username, account.password, new_elevage_id)

        if (new_buses) {
            await db.prepare("DELETE FROM buses WHERE elevageId = ?").run(account.elevageId)
            await db.prepare("UPDATE accounts SET elevageId = ? WHERE id = ?").run(new_elevage_id, account.id)
        } else {
            const embed = new EmbedBuilder()
                .setColor(Red)
                .setTitle("L'identifiant de l'elevage est incorrect!")
            await interaction.editReply({ embeds: [embed] })
            return
        }
    }

    const embed = new EmbedBuilder()
        .setColor(Green)
        .setTitle(`Compte mis a jour !`)
        .setDescription(`Le compte **\`${username}\`** a été modifié.`);
    await interaction.editReply({ embeds: [embed] })

}

async function account_remove(interaction) {
    const username = interaction.options.getString('username')

    let account = await db.prepare('SELECT * FROM accounts WHERE username = ?').get(username)

    if (account) {
        await db.prepare('DELETE FROM accounts WHERE id = ?').run(account.id)
        await db.prepare('DELETE FROM buses WHERE elevageId = ?').run(account.elevageId)

        const embed = new EmbedBuilder()
            .setColor(Green)
            .setTitle("Compte supprimé !")
            .setDescription(`Le compte **\`${username}\`** a été retiré.`)

        await interaction.reply({ embeds: [embed], ephemeral: true })
    } else {
        const embed = new EmbedBuilder()
            .setColor(Red)
            .setTitle("Ce compte n'existe pas !")
            .setDescription(`Le compte **${username}** n'existe pas`)
        await interaction.reply({ embeds: [embed], ephemeral: true })
    }
}

async function account_list(interaction) {
    let accounts = await db.prepare('SELECT username, password FROM accounts').all()

    const embed = new EmbedBuilder()
        .setColor(accounts.length ? Blue : Yellow)
        .setTitle(accounts.length ? "List des comptes:" : "Aucun compte pour l'instant")

    if (accounts.length) {
        accounts.map(account => {
            embed.addFields({ name: `*${account.username}*`, value: "\\*".repeat(account.password.length) })
        })
    }

    await interaction.reply({ embeds: [embed], ephemeral: true })
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("account")
        .setDescription("Gestion des comptes")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("add")
                .setDescription("Pour ajouter un compte")
                .addStringOption(option =>
                    option
                        .setName('username')
                        .setDescription("Le nom d'utilisateur du compte")
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('password')
                        .setDescription('Le mot de passe du compte')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('elevage-id')
                        .setDescription("L'identifiant de l'elevage a utiliser")
                        .setRequired(true)))
        .addSubcommand((subcommand) =>
            subcommand
                .setName("edit")
                .setDescription("Pour modifier un compte")
                .addStringOption(option =>
                    option
                        .setName('username')
                        .setDescription("Le nom d'utilisateur du compte a modifier")
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('new-username')
                        .setDescription("Le nouveau nom d'utilisateur"))
                .addStringOption(option =>
                    option
                        .setName('new-password')
                        .setDescription('Le nouveau mot de passe du compte'))
                .addStringOption(option =>
                    option
                        .setName('new-elevage-id')
                        .setDescription("L'identifiant du nouvel elevage a utiliser")))
        .addSubcommand((subcommand) =>
            subcommand
                .setName("remove")
                .setDescription("Pour enlever un compte")
                .addStringOption(option =>
                    option
                        .setName('username')
                        .setDescription("Le nom d'utilisateur du compte a supprimer")
                        .setRequired(true)))
        .addSubcommand((subcommand) =>
            subcommand
                .setName("list")
                .setDescription("Pour lister tous les comptes ajoutés")),
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand()

        commands = {
            'add': account_add,
            'edit': account_edit,
            'remove': account_remove,
            'list': account_list
        }

        await commands[subcommand](interaction)
    }
};
