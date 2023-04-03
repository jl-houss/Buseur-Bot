const puppeteer = require("puppeteer");
const db = require('better-sqlite3')('./main.db');


const isHeadless = process.env.SHOWBROWSER === "oui" ? false : true

function sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time))
}

async function update_cookie(username, password) {
    return new Promise(async (resolve) => {
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
        await page.type("#login", username);
        await page.type("#password", password);
        await page.click("#autoidentification");
        await page.click("#authentificationSubmit");

        await sleep(1000);

        var cookies = await page.cookies();

        var cookie = cookies.find((cookie) => cookie.name === "autoLoginprod");
        let autoLoginprod = cookie ? cookie.value : null

        await browser.close();

        resolve(autoLoginprod);
    });
}

async function get_buses(username, password, elevage_id) {
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
    await page.type("#login", username);
    await page.type("#password", password);
    await page.click("#authentificationSubmit");

    await sleep(1000);

    await page.goto(`https://gaia.equideow.com/elevage/chevaux/?elevage=${elevage_id}`)

    await sleep(1000);

    let busesIds = await page.evaluate(`
        function sleep(time) {
            return new Promise(resolve => setTimeout(resolve, time))
        }

        (async () => {
            let busesIds = []

            for (let i = 0; i <= 100; i++) {
                let pageLink = Array.from(document.querySelectorAll(".page > a")).find(link => link.getAttribute("data-page") == i)
                if (!pageLink) {
                    break
                }
                pageLink.click()
                await sleep(800)

                for (let buse of document.querySelectorAll("a.horsename")) {
                    busesIds.push(parseInt(buse.getAttribute("href").replace("/elevage/chevaux/cheval?id=", "")))
                }
            }

            return busesIds

        })()
    `)

    if (!busesIds.length) {
        return null
    }

    let old_buses = []

    db.prepare('SELECT buseId FROM buses WHERE elevageId = ?').all(elevage_id).forEach(item => old_buses.push(item.buseId));

    let to_add = []

    busesIds.forEach(buseId => {
        if (!old_buses.includes(buseId)) {
            to_add.push(buseId)
        }
    })

    console.log(old_buses);

    let buses = []

    for (let buseId of to_add) {
        console.log(buseId);
        if (old_buses.includes(buseId)) {
            continue
        }

        await get_horse_page(page, buseId)

        let buseInfos = await get_horse_infos(page, buseId)

        if (buseInfos.stats.Sante && buseInfos.wins < 20) {
            db.prepare("INSERT INTO buses (elevageId, buseId, type, endurance, vitesse, dressage, galop, trot, saut) VALUES (?,?,?,?,?,?,?,?,?)").
                run(elevage_id,
                    buseInfos.id,
                    buseInfos.type,
                    Math.ceil(buseInfos.stats.Endurance / 500),
                    Math.ceil(buseInfos.stats.Vitesse / 500),
                    Math.ceil(buseInfos.stats.Dressage / 500),
                    Math.ceil(buseInfos.stats.Galop / 500),
                    Math.ceil(buseInfos.stats.Trot / 500),
                    Math.ceil(buseInfos.stats.Saut / 500));
            console.log("added");
            old_buses.push(buseId)
        }

    }

    await browser.close()
    return buses
}

async function get_horse_page(page, horseId) {
    await page.evaluate(`
        (async () => {
            res = await fetch('https://gaia.equideow.com/elevage/chevaux/cheval?id=${horseId}')
            page = await res.text()
            horsePage = new DOMParser().parseFromString(page, "text/html");
            document.querySelector("body").replaceWith(horsePage.querySelector("BODY"));
        })()
    `)
}

async function get_horse_infos(page, horseId) {
    return await page.evaluate(`
        (async () => {
            var get_stat = (id) => {
                let stat = document.querySelector(id).innerText;
                return parseFloat(stat);
            };

            let competition = document.querySelector("#competition-body-content > table > tbody > tr:nth-child(1) > td.first.top > a");
            let specialisation = document.querySelector("#trainingAndSpecialisationBlock > div > div > div:nth-child(2) > div");
            let type
            if (competition) {
                type = competition.innerText == "Barrel racing" ? "Western" : "Classique"
            } else {
                type = ["Cette jument est spécialisée en équitation western.", "Ce cheval est spécialisé en équitation western."].includes(specialisation.innerText) ? "Western" : "Classique"
            }

            hour = document.querySelector('.hour').innerText.split(':')

            let wins = 0

            for (let row of document.querySelector("#achievements-0-content").querySelector("table").querySelector("tbody").querySelectorAll(".dashed")) {

                wins += parseInt(row.querySelectorAll("th")[1].querySelector("strong").innerText)

            }

            let infos = {
                'id': ${horseId},
                'name': document.querySelector(".horse-name > a").innerText,
                'type': type,
                'stats': {
                    'Energie': get_stat("#energie"),
                    'Sante': get_stat("#sante"),
                    'Moral': get_stat("#moral"),
                    'Endurance': get_stat("#enduranceValeur"),
                    'Vitesse': get_stat("#vitesseValeur"),
                    'Dressage': get_stat("#dressageValeur"),
                    'Galop': get_stat("#galopValeur"),
                    'Trot': get_stat("#trotValeur"),
                    'Saut': get_stat("#sautValeur"),
                },
                'time': { 'hour': parseInt(hour[0]), 'minutes': parseInt(hour[1]) },
                'wins': wins,
                'awake': document.querySelector("#countDownWakeUp") ? false : true,
            };

            return infos
        })()
    `)
}

async function remove_ovnis(page) {
    await page.evaluate(`
        (async () => {
            let ovni = document.getElementById("Ufo_0")
            if (ovni) { ovni.click() }
        })()
    `)
}

module.exports = {
    update_cookie,
    sleep,
    get_horse_infos,
    get_horse_page,
    get_buses,
    remove_ovnis
}