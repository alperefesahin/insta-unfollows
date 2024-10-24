const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function handleOutput(outputType, outputData) {
  const outputStyles = `padding: 0.5rem 0; font-size: 1rem; font-weight: 700;`;

  if (outputType === "PROGRESS") {
    console.clear();
    console.warn(`%cProgress: ${outputData.currentPageCount}/${outputData.totalFollowing} (${parseInt(outputData.currentPageCount / outputData.totalFollowing * 100)}%)`, outputStyles);
  } else if (outputType === "FINISH") {
    console.clear();
    if (outputData.unfollowers.length === 0) {
      return console.warn(`%cPROCESS FINISHED - Everyone followed you back! 😄`, outputStyles);
    }

    console.group(`%cPROCESS FINISHED - ${outputData.unfollowers.length} ${outputData.unfollowers.length === 1 ? "user" : "users"} didn't follow you back. 🤬 (Verified users not included)`, outputStyles);

    outputData.unfollowers.forEach(unfollower => {
      console.log(`%c@%c${unfollower.username}`, "color: blue;", "color: black;");
    });

    console.groupEnd();
    console.log("%cDone ✔️", "color: green; font-weight: bold;");
  }
}

class UnfollowerChecker {
  constructor() {
    this.unfollowers = [];
    this.hasMorePages = false;
    this.nextPageCursor = "";
    this.requestCount = 0;
    this.totalFollowing = 0;
    this.currentPageCount = 0;
    this.estimatedStepSize = 0;
  }

  getCookie(cookieName) {
    return new Promise((resolve, reject) => {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const [name, value] = cookie.split("=");
        if (name.trim() === cookieName) resolve(decodeURIComponent(value));
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
    if (this.nextPageCursor) params.variables.after = this.nextPageCursor;
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

        this.hasMorePages = data.user.edge_follow.page_info.has_next_page;
        this.nextPageCursor = data.user.edge_follow.page_info.end_cursor;
        this.requestCount++;
        this.totalFollowing = data.user.edge_follow.count;
        this.currentPageCount += data.user.edge_follow.edges.length;

        if (this.estimatedStepSize === 0) this.estimatedStepSize = data.user.edge_follow.edges.length;
        handleOutput("PROGRESS", { currentPageCount: this.currentPageCount, totalFollowing: this.totalFollowing });

        await sleep(3000);
      } while (this.hasMorePages);

      handleOutput("FINISH", { unfollowers: this.unfollowers });
    } catch (error) {
      console.error(`Something went wrong!\n${error}`);
      console.warn("Retrying after 15 seconds...");
      await sleep(15000);  // Retry after 15 seconds on any error
      this.startScript();   // Restart the script
    }
  }
}

const unfollowerChecker = new UnfollowerChecker();
unfollowerChecker.startScript();
