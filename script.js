const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function handleOutput(type, data) {
  const styles = `padding: 0.5rem 0; font-size: 1rem; font-weight: 700;`;

  if (type === "PROGRESS") {
    console.clear();
    console.warn(`%cProgress: ${data.currentPageCount}/${data.followingCount} (${parseInt(data.currentPageCount / data.followingCount * 100)}%)`, styles);
  } else if (type === "FINISH") {
    console.clear();
    if (data.unfollowers.length === 0) {
      return console.warn(`%cPROCESS FINISHED - Everyone followed you back! 😄`, styles);
    }

    console.group(`%cPROCESS FINISHED - ${data.unfollowers.length} ${data.unfollowers.length === 1 ? "user" : "users"} didn't follow you back. 🤬 (Verified users not included)`, styles);

    data.unfollowers.forEach(unfollower => {
      console.log(`%c@%c${unfollower.username}`, "color: blue;", "color: black;");
    });

    console.groupEnd();
    console.log("%cDone ✔️", "color: green; font-weight: bold;");
  }
}

class Script {
  constructor() {
    this.unfollowers = [];
    this.canQuery = false;
    this.nextPageHash = "";
    this.requestsCount = 0;
    this.followingCount = 0;
    this.currentPageCount = 0;
    this.estimatedStepValue = 0;
  }

  getCookie(cookieName) {
    return new Promise((resolve, reject) => {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const pair = cookie.split("=");
        if (pair[0].trim() === cookieName) resolve(decodeURIComponent(pair[1]));
      }
      reject("Cookie not found!");
    });
  }

  createURLParamsString(params) {
    return Object.keys(params)
      .map(key => `${key}=${typeof params[key] === "object" ? JSON.stringify(params[key]) : params[key]}`)
      .join("&");
  }

  async generateURL() {
    const params = {
      query_hash: "3dec7e2c57367ef3da3d987d89f9dbc8",
      variables: {
        id: await this.getCookie("ds_user_id"),
        first: "1000"
      }
    };
    if (this.nextPageHash) params.variables.after = this.nextPageHash;
    return `https://www.instagram.com/graphql/query/?${this.createURLParamsString(params)}`;
  }

  async startScript() {
    try {
      do {
        const url = await this.generateURL();
        const { data } = await fetch(url).then(res => res.json());

        data.user.edge_follow.edges.forEach(edge => {
          if (!edge.node.is_verified && !edge.node.follows_viewer) {
            this.unfollowers.push({ username: edge.node.username });
          }
        });

        this.canQuery = data.user.edge_follow.page_info.has_next_page;
        this.nextPageHash = data.user.edge_follow.page_info.end_cursor;
        this.requestsCount++;
        this.followingCount = data.user.edge_follow.count;
        this.currentPageCount += data.user.edge_follow.edges.length;

        if (this.estimatedStepValue === 0) this.estimatedStepValue = data.user.edge_follow.edges.length;
        handleOutput("PROGRESS", { currentPageCount: this.currentPageCount, followingCount: this.followingCount });

        await sleep(3000);
      } while (this.canQuery);

      handleOutput("FINISH", { unfollowers: this.unfollowers });
    } catch (error) {
      console.error(`Something went wrong!\n${error}`);
      console.warn("Retrying after 15 seconds...");
      await sleep(15000);  // Retry after 15 seconds on any error
      this.startScript();   // Restart the script
    }
  }
}

const script = new Script();
script.startScript();
