const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function handleOutput(outputType, outputData) {
  const outputStyles = `padding: 0.5rem 0; font-size: 1rem; font-weight: 700;`;

  if (outputType === "PROGRESS") {
    console.clear();
    console.warn(`%cIn progress`, outputStyles);
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

class FollowerCheck {
  constructor() {
    this.unfollowers = [];
    this.hasMorePages = false;
    this.paginationCursor = "";
    this.apiRequestCount = 0;
    this.totalFollowings = 0;
    this.processedFollowings = 0;
  }

  getCookieValue(cookieName) {
    return new Promise((resolve, reject) => {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const pair = cookie.split("=");
        if (pair[0].trim() === cookieName) resolve(decodeURIComponent(pair[1]));
      }
      reject("Cookie not found!");
    });
  }

  createQueryString(params) {
    return Object.keys(params)
      .map(key => `${key}=${typeof params[key] === "object" ? JSON.stringify(params[key]) : params[key]}`)
      .join("&");
  }

  async buildApiUrl() {
    const queryParams = {
      query_hash: "3dec7e2c57367ef3da3d987d89f9dbc8",
      variables: {
        id: await this.getCookieValue("ds_user_id"),
        first: "1000"
      }
    };
    if (this.paginationCursor) queryParams.variables.after = this.paginationCursor;
    return `https://www.instagram.com/graphql/query/?${this.createQueryString(queryParams)}`;
  }

  async start() {
    try {
      do {
        const apiUrl = await this.buildApiUrl();
        const { data } = await fetch(apiUrl).then(res => res.json());

        data.user.edge_follow.edges.forEach(following => {
          if (!following.node.is_verified && !following.node.follows_viewer) {
            this.unfollowers.push({ username: following.node.username });
          }
        });

        this.hasMorePages = data.user.edge_follow.page_info.has_next_page;
        this.paginationCursor = data.user.edge_follow.page_info.end_cursor;
        this.apiRequestCount++;
        this.totalFollowings = data.user.edge_follow.count;
        this.processedFollowings += data.user.edge_follow.edges.length;

        handleOutput("PROGRESS", {});
        await sleep(3000);
      } while (this.hasMorePages);

      handleOutput("FINISH", { unfollowers: this.unfollowers });
    } catch (error) {
      console.error(`Something went wrong!\n${error}`);
      console.warn("Retrying after 15 seconds...");
      await sleep(15000);  // Retry after 15 seconds on any error
      this.start();   // Restart the script
    }
  }
}

const followerCheck = new FollowerCheck();
followerCheck.start();
