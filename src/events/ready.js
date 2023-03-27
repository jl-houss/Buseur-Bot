module.exports = {
    name: "ready",
    once: true,
    async execute(client) {
        let tag = client.user.tag;
        console.log("Connecté en tant que : " + tag);
    },
};
