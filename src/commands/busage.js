const { SlashCommandBuilder } = require("@discordjs/builders");
const db = require('better-sqlite3')('./main.db');
const { EmbedBuilder } = require('discord.js');
const puppeteer = require("puppeteer");
const { sleep, get_horse_infos, get_horse_page, remove_ovnis } = require("../utils/functions");

const Green = 0x57F287
const Red = 0xED4245
const Yellow = 0xFFFF00

const isHeadless = process.env.SHOWBROWSER === "oui" ? false : true

const raceTypes = {
    Western: [
        "cutting",
        "barrel",
        "trailClass",
        "reining",
        "westernPleasure",
    ],
    Classique: ["dressage", "galop", "trot", "cross", "cso"],
};

const raceNames = {
    cutting: 'Cutting',
    barrel: 'Barrel racing',
    trailClass: 'Trail class',
    reining: 'Reining',
    westernPleasure: 'Western pleasure',
    dressage: 'Dressage',
    galop: 'Galop',
    trot: 'Trot',
    cross: 'Cross',
    cso: 'Cso'
}

const raceStats = {
    // Western
    cutting: "Endurance",
    barrel: "Vitesse",
    trailClass: "Dressage",
    reining: "Galop",
    westernPleasure: "Trot",

    // Classique
    dressage: "Dressage",
    galop: "Galop",
    trot: "Trot",
    cross: "Endurance",
    cso: "Saut",
};

async function get_horse_compets(page, horseId) {
    return await page.evaluate(`
        (async () => {
            let horseCompets = []
            // let clicks = [(".caption-module width-23", 2), (".caption-module width-23", 2), ("caption-module width-10 align-center", 3), ("caption-module width-10 align-center", 3)]
            for (let competition of document.querySelectorAll("tbody > tr.highlight")) {
                let competInfos = {
                    name: competition.querySelector(".competition") ? competition.querySelector(".competition").innerText : "Grand Prix de Ow",
                    energie: parseFloat(competition.querySelector("td.width-20 > strong").innerText),
                    participantsNames: [],
                    participants: [],
                    places: parseInt(competition.querySelector("td.width-5.align-center > strong").innerText),
                    buttonId: competition.querySelector("button").getAttribute("id")
                }

                for (let participant of competition.querySelectorAll("a.horsename")) {
                    let participantName = participant.innerText;
                    let participantId = parseInt(participant.getAttribute("href").replace("/elevage/fiche/?id=", ""));
                    competInfos.participantsNames.push(participantName)
                    competInfos.participants.push(participantId)
                }

                if (competInfos.participants.includes(${horseId})) {
                    horseCompets.push(competInfos)
                }
            }

            return horseCompets
        })()
    `)
}

async function get_compets_page(page, horseId, race) {
    await page.evaluate(`
        (async () => {
            res = await fetch('https://gaia.equideow.com/elevage/competition/liste', { method: 'POST', body: new URLSearchParams({ id: ${horseId}, type: '${race}' }) })
            page = await res.json()
            competsPage = new DOMParser().parseFromString(page.content, "text/html");
            document.querySelector("body").replaceWith(competsPage.querySelector("BODY"));
        })()
    `)
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("busage")
        .setDescription("Pour buser un cheval")
        .addNumberOption(option =>
            option
                .setName("horse-id")
                .setDescription("L'identifiant du cheval a buser")
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName("race-type")
                .setDescription("Le type de competition")
                .setChoices(
                    { name: 'Cutting', value: 'cutting' },
                    { name: 'Barrel racing', value: 'barrel' },
                    { name: 'Trail class', value: 'trailClass' },
                    { name: 'Reining', value: 'reining' },
                    { name: 'Western pleasure', value: 'westernPleasure' },
                    { name: 'Dressage', value: 'dressage' },
                    { name: 'Galop', value: 'galop' },
                    { name: 'Trot', value: 'trot' },
                    { name: 'Cross', value: 'cross' },
                    { name: 'Cso', value: 'cso' })
                .setRequired(true)),
    async execute(interaction, client) {
        const horseId = interaction.options.getNumber('horse-id')
        const race_type = interaction.options.getString('race-type')

        let finishvictories = false
        let toSDB = {}
        let competsCount = 0

        const accounts = await db.prepare("SELECT * FROM accounts").all()

        if (!accounts.length) {
            const embed = new EmbedBuilder()
                .setColor(Red)
                .setTitle("Aucun compte a utiliser !")
                .setDescription("Veuillez ajouter un compte en utilisant la commande **\`/account add\`**.")

            await interaction.reply({ embeds: [embed], ephemeral: true })
            return
        }

        await interaction.deferReply({ ephemeral: false })
        let joinedCompets = []

        for (let account of accounts) {
            console.log(account.username);
            const browser = await puppeteer.launch({ headless: isHeadless });
            const page = await browser.newPage();

            page.setDefaultNavigationTimeout(0);
            await page.setViewport({ width: 1200, height: 750 });

            await page.goto("https://gaia.equideow.com/site/logIn");

            var [cookieBtn] = await page.$x(
                "/html/body/aside/div/article/div/div[2]/div/div/div[3]/form/button"
            );

            if (cookieBtn) {
                cookieBtn.click();
            }

            await page.waitForNavigation();
            await page.type("#login", account.username);
            await page.type("#password", account.password);
            await page.click("#authentificationSubmit");

            await sleep(500);

            await page.goto(`https://gaia.equideow.com/elevage/fiche/?id=${horseId}`)

            await sleep(500)

            await remove_ovnis(page)

            let horseInfos = await get_horse_infos(page, horseId)

            console.log(horseInfos);

            if (horseInfos.wins >= 20 && !competsCount) {
                const embed = new EmbedBuilder()
                    .setColor(Red)
                    .setTitle("Le cheval a déja 20 victoires !");

                await interaction.editReply({ embeds: [embed] })
                await browser.close()
                return
            } else if ((horseInfos.wins >= 20 && competsCount) || finishvictories) {
                const embed = new EmbedBuilder()
                    .setColor(Green)
                    .setTitle("Le cheval a atteint les 20 victoires !");

                for (let joinedCompet of joinedCompets) {
                    embed.addFields({ name: `*${joinedCompet.name}*`, value: joinedCompet.participants.join("\n"), inline: true })
                }

                await interaction.editReply({ embeds: [embed] })
                await browser.close()
                finishvictories = true
                break
            }

            if (!raceTypes[horseInfos.type].includes(race_type)) {
                const embed = new EmbedBuilder()
                    .setColor(Red)
                    .setTitle("Le type de competition ne correspond pas !")
                    .setDescription(`Les chevaux **${horseInfos.type}** ne peuvent pas acceder les competitions **${raceNames[race_type]}** competitions.`)

                await interaction.editReply({ embeds: [embed] })
                await browser.close()
                return
            }
            console.log(race_type);

            const highest_level = await db.prepare(`SELECT ${raceStats[race_type]} FROM buses WHERE elevageId = ? AND type = ? ORDER BY ${raceStats[race_type]} DESC`).get(account.elevageId, horseInfos.type)[raceStats[race_type]]

            for (let level = 1; level < highest_level + 1; level++) {
                const busesIds = []
                await db.prepare(`SELECT buseId FROM buses WHERE elevageId = ? AND type = ? AND ${raceStats[race_type]} = ?`).all(account.elevageId, horseInfos.type, level).forEach(element => busesIds.push(element.buseId));

                console.log(busesIds);

                await get_horse_page(page, horseId)

                horseInfos = await get_horse_infos(page, horseId)

                console.log(horseInfos);

                if (horseInfos.wins >= 20) {
                    finishvictories = true
                    break
                }

                let i = 0

                for (let buseId of busesIds) {
                    console.log(buseId);
                    await get_horse_page(page, buseId)
                    await sleep(1000)
                    let buseInfos = await get_horse_infos(page, buseId)

                    if (buseInfos === "dead") {
                        await db.prepare("DELETE FROM buses WHERE buseId = ?").run(buseId)
                        continue
                    }

                    if (buseInfos.age.includes("ans")) {
                        if (buseInfos.age.split(" ")[0] > 31) {
                            await db.prepare("DELETE FROM buses WHERE buseId = ?").run(buseId)
                            continue
                        }
                    }

                    if (buseInfos.stats.Sante <= 0 || buseInfos.wins >= 20) {
                        await db.prepare("DELETE FROM buses WHERE buseId = ?").run(buseId)
                        console.log("0 pv ou 20 victoires");
                        continue
                    }

                    if (!buseInfos.awake) {
                        console.log("couché");
                        continue
                    }

                    if (buseInfos.stats.Energie < 31 || buseInfos.time.hour > 20 || (buseInfos.time.hour === 20 && buseInfos.time.minutes > 15)) {
                        if (!(account.username in toSDB)) {
                            toSDB[account.username] = []
                        }
                        toSDB[account.username].push(buseId)
                        console.log("< 31 energie ou > 21h15");
                        continue
                    }

                    if (i == 3) {
                        break
                    }

                    await get_compets_page(page, buseId, race_type)

                    await sleep(1000)

                    let compets = await get_horse_compets(page, horseId)
                    console.log("there's", compets.length);
                    if (compets.length) {
                        competsCount += compets

                        for (let _ of compets) {
                            if (buseInfos.stats.Energie < 31 || buseInfos.time.hour > 20 || (buseInfos.time.hour === 20 && buseInfos.time.minutes > 15)) {
                                if (!(account.username in toSDB)) {
                                    toSDB[account.username] = []
                                }
                                toSDB[account.username].push(buseId)
                                await competsPage.close()
                                break
                            }
                            let competsPage = await browser.newPage()

                            await competsPage.goto(`https://gaia.equideow.com/elevage/competition/inscription?cheval=${buseId}&competition=${race_type}`)

                            await sleep(500)

                            await remove_ovnis(competsPage)

                            let pageCompets = await get_horse_compets(competsPage, horseId)

                            console.log(pageCompets);

                            if (!pageCompets.length) {
                                await competsPage.close()
                                break
                            }

                            for (let pageCompet of pageCompets) {
                                let btn = await competsPage.$(`#${pageCompet.buttonId}`)
                                console.log(btn);
                                await btn.click()
                                console.log(`${buseId} a rejoint ${pageCompet.name}`);
                                horseInfos.stats.Energie -= pageCompet.energie
                                horseInfos.time.hour += 2

                                if (pageCompet.places == 1) {
                                    pageCompet.participantsNames.push(buseInfos.name)

                                    joinedCompets.push(pageCompet.participantsNames)
                                }

                                break
                            }

                            await competsPage.close()
                        }
                    } else {
                        i++
                    }


                }
            }

            await browser.close()
        }

        if (!finishvictories) {
            if (competsCount) {
                const embed = new EmbedBuilder()
                    .setColor(Green)
                    .setTitle("Busage terminé!")

                for (let joinedCompet of joinedCompets) {
                    embed.addFields({ name: `*${joinedCompet.name}*`, value: joinedCompet.participants.join("\n"), inline: true })
                }

                await interaction.editReply({ embeds: [embed] })
            } else {
                const embed = new EmbedBuilder()
                    .setColor(Yellow)
                    .setTitle("Aucune competition trouvé !");

                await interaction.editReply({ embeds: [embed] })
            }
        }

        console.log(toSDB);

        for (let username of Object.keys(toSDB)) {
            const account = await db.prepare("SELECT username, password FROM accounts WHERE username = ?").get(username)

            const browser = await puppeteer.launch({ headless: isHeadless });
            let page = await browser.newPage();

            page.setDefaultNavigationTimeout(0);
            await page.setViewport({ width: 1200, height: 750 });

            await page.goto("https://gaia.equideow.com/site/logIn");

            var [cookieBtn] = await page.$x(
                "/html/body/aside/div/article/div/div[2]/div/div/div[3]/form/button"
            );

            if (cookieBtn) {
                cookieBtn.click();
            }

            await page.waitForNavigation();
            await page.type("#login", account.username);
            await page.type("#password", account.password);
            await page.click("#authentificationSubmit");

            await sleep(1000);

            for (let buseId of toSDB[username]) {
                await page.goto(`https://gaia.equideow.com/elevage/chevaux/cheval?id=${buseId}`)

                await sleep(500)

                await remove_ovnis(page)

                await sleep(500)

                let buseInfos = await get_horse_infos(page, buseId);

                await db.prepare("UPDATE buses SET Endurance = ?, Vitesse = ?, Dressage = ?, Galop = ?, Trot = ?, Saut = ? WHERE buseId = ?").
                    run(Math.ceil(buseInfos.stats.Endurance / 500),
                        Math.ceil(buseInfos.stats.Vitesse / 500),
                        Math.ceil(buseInfos.stats.Dressage / 500),
                        Math.ceil(buseInfos.stats.Galop / 500),
                        Math.ceil(buseInfos.stats.Trot / 500),
                        Math.ceil(buseInfos.stats.Saut / 500),
                        buseInfos.id)

                console.log("updated " + buseId);

                const CE = await page.$("#cheval-inscription"); // Check si besoin CE

                if (CE) {
                    const CEPage = await browser.newPage();
                    let CELink = await (await (await CE.$("a")).getProperty("href")).jsonValue()

                    await CEPage.goto(CELink)

                    await sleep(500)

                    await remove_ovnis(CEPage)

                    await sleep(800)

                    await CEPage.evaluate(`
                        function sleep(time) {
                            return new Promise((resolve) => setTimeout(resolve, time));
                        }

                        (async () => {
                            await document.getElementById("fourrageCheckbox").click(); // CE avec fourrage
                            await document.getElementById("avoineCheckbox").click();
                            await sleep(800)
                            Array.from(await document.querySelectorAll("a")).find((el) => el.textContent.includes("3 jours")).click()
                            await sleep(800)
                            await document.querySelector("#table-0 > tbody > tr:nth-child(1) > td:nth-child(8) > button").click()
                        })()
                    `)
                    await CEPage.close()
                    await page.reload()
                    console.log("did box");
                }

                await sleep(500)

                await remove_ovnis(page)

                await sleep(500)

                console.log("starting sdb");
                await page.evaluate(`
                    function sleep(time) {
                            return new Promise((resolve) => setTimeout(resolve, time));
                    }

                    (async () => {
                        let ovni = document.getElementById("Ufo_0")
                        
                        if (ovni) {ovni.click()}

                        let age = parseInt(
                            document
                                .getElementById("characteristics")
                                .querySelector(".align-right")
                                .textContent.slice(6, 8)
                        ); // Age cheval
                        if (age < 32) {
                            const CE = document.getElementById("cheval-inscription"); // Check si besoin CE

                            if (CE) {
                                CE.querySelector("a").click(); // Ouvrir l'inscription en CE
                            }
                            await sleep(800);
                            let msgPrblmPoids = document
                                .querySelector("#care-tab-feed")
                                .querySelector("#messageBoxInline");
                            let tropMaigre = false;
                            let tropGros = false;
                            if (msgPrblmPoids !== null) {
                                tropMaigre = msgPrblmPoids.textContent.indexOf("maigre") !== -1;
                                tropGros = msgPrblmPoids.textContent.indexOf("gros") !== -1;
                            }
                            if (!tropGros) {
                                document.getElementById("boutonNourrir").click();
                                await sleep(800);
                                let qtteFourrageRequise = parseInt(
                                    document.querySelector(".section-fourrage-target").textContent
                                );
                                let qtteAvoineRequise = 0;
                                let qtteAvoineDonnee = 1;
                                let testAvoine = document.querySelector(".section-avoine-target");
                                if (testAvoine !== null) {
                                    qtteAvoineRequise = parseInt(
                                        document.querySelector(".section-avoine-target").textContent
                                    );
                                    qtteAvoineDonnee = parseInt(
                                        document.querySelector(".section-avoine-quantity").textContent
                                    );
                                }
                                let qtteFourrageDonnee = parseInt(
                                    document.querySelector(".section-fourrage-quantity").textContent
                                );

                                if (tropMaigre) {
                                    qtteFourrageRequise = 20;
                                }
                                let fourrage = qtteFourrageRequise - qtteFourrageDonnee;
                                let avoine = qtteAvoineRequise - qtteAvoineDonnee;
                                if (fourrage > 0) {
                                    document
                                        .querySelector("#haySlider ol")
                                        .querySelectorAll(".alternative, .green")
                                    [fourrage].click();
                                }
                                if (avoine > 0) {
                                    document
                                        .querySelector("#oatsSlider ol")
                                        .querySelectorAll(".alternative, .green")
                                    [avoine].click();
                                }
                                await sleep(200);
                                document.getElementById("feed-button").click();
                                await sleep(200);
                                document.getElementById("boutonCaresser").click();
                                await sleep(200);
                                document.getElementById("boutonBoire").click();
                                await sleep(200);
                                document.getElementById("boutonPanser").click();
                                await sleep(200);
                                document.getElementById("boutonCoucher").click();
                                await sleep(200);
                            }
                        }
                    })()
                `)
                console.log("did sdb");
            }
            await browser.close()
        }
    }
}
