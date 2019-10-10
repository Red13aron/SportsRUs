const express = require("express");
const logger = require("morgan");
const mongoose = require("mongoose");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
const axios = require("axios");
const cheerio = require("cheerio");

// Require all models
const db = require("./models");

const PORT = 3000;

// Initialize Express
const app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

// Connect to the Mongo DB
mongoose.connect("mongodb://localhost/sportsRUs", { useNewUrlParser: true });

// Routes

// A GET route for scraping the echoJS website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with axios
  axios.get("https://www.espn.com/nfl/").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    const $ = cheerio.load(response.data);
    console.log("Hi!");
    const list = $(".headlineStack__list");
    // console.log(list.children().children().children().find("a").children());
    let headlines = []
    let links = []
    list.find($("a")).each(function(i, element){
        if(headlines.indexOf($(element).text()) === -1){
          headlines.push($(element).text());
        }
        if(links.indexOf("espn.com" + $(element).attr("href")) === -1){
          links.push("https://www.espn.com" + $(element).attr("href"))
        }
    });

    for(let i = 0; i < headlines.length; i++){
      headlines[i] = headlines[i].replace("'", '')
    }

    results = [];
    for(let i = 0; i < headlines.length; i++){
      results[i] = {
        headline: headlines[i],
        link: links[i]
      }
    }

    console.log(results);
    console.log(results[0].link);
    for(let i = 0; i<results.length; i++){
      axios.get(results[i].link).then(function(response){
        const $ = cheerio.load(response.data);
        const summary = $("meta[name=description] ").attr("content");
        results[i].summary = summary;
              // Create a new Article using the `result` object built from scraping
        db.Article.create(results[i])
        .then(function(dbArticle) {
         // View the added result in the console
         console.log(dbArticle);
           })
        .catch(function(err) {
         // If an error occurred, log it
         console.log(err);
        });
        return;
      });

    }
    
    console.log(results);
    // Send a message to the client
    res.send("Scrape for Headlines and Links and Summaries Complete");
  });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});