const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const PORT = 3001;
const SECRET_KEY = "webops2024"; //for signing the jwt token
const app = express();
const prisma = new PrismaClient();
const twilio = require("twilio");

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
console.log("Connected to the DB");
let otpStore = {};
//define the interfaces

//add the necessary middlewares
app.use(cors());
app.use(bodyParser.json());

//index route
app.get("/", (req, res) => {
  res.send("Server running");
});

//auth routes
app.post("/sendotp", async (req, res) => {
  const { PhoneNo, CountryCode } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000);
  if (otpStore[PhoneNo]) {
    clearTimeout(timeout);
  }
  otpStore[PhoneNo] = otp;
  const message = `Your TradeCraft OTP is ${otp}`;
  console.log(PhoneNo, CountryCode);
  try {
    const messageCreate = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `${CountryCode}${PhoneNo}`,
    });
    const timeout = setTimeout(() => {
      otpStore[PhoneNo] = null;
    }, 5000 * 60);
    console.log(message);
    res.status(200).send({ message: "OTP sent" });
  } catch (err) {
    res.status(500).send({ error: err });
  }
});
app.post("/signup", (req, res) => {
  const { PhoneNo, password, email, otp } = req.body;
  const saltRounds = 10;
  console.log("hello");
  console.log(PhoneNo, password, email);

  //hashing the password using bcrypt js
  if (otp == otpStore[PhoneNo]) {
    bcrypt
      .hash(password, saltRounds)
      .then(async (hashedPassword) => {
        //create the user here.
        console.log("Password hashed successfully.");
        const user = await prisma.User.create({
          data: {
            phone: PhoneNo,
            password: hashedPassword,
            email: email,
          },
        });
        if (user) {
          const token = jwt.sign({ userId: user.id }, SECRET_KEY);
          res.status(200).json({ message: "User created successfully." });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({ message: "Server error: " + err }); //this here would basically return an error if the username is already taken. or for any other error, the error will be sent to the frontend.
      });
  } else {
    res.status(401).json({ message: "incorrect otp" });
  }
});

app.post("/signin", async (req, res) => {
  const { PhoneNo, password, email } = req.body;
  console.log(PhoneNo, password, email);
  //check if the user exists on the DB,if exists retreive it and compare the password

  const user = await prisma.user.findUnique({
    where: {
      phone: PhoneNo,
    },
  });
  //   async function func() {
  //     const db = await prisma.user.deleteMany();
  //     const db1 = await prisma.user.findMany();
  //     console.log(db1);
  //   }
  //   func();
  if (user) {
    //if user exists, log him in
    const hashedPassword = user.password;
    bcrypt
      .compare(password, hashedPassword) //hashedPassword will be retreived from the database.
      .then((result) => {
        if (result) {
          //now send the token to the client and make it store in the localstorage.
          const token = jwt.sign({ userId: user.id }, SECRET_KEY);
          res.status(200).json({ token: token, message: "Login successful" });
        } else {
          console.log("galat");
          res.status(401).json({ message: "Invalid credentials" });
        }
      })
      .catch((err) => {
        res.status(500).json({ message: "Internal server error" });
      });
  } else {
    console.log("not found");
    res.status(401).json({ message: "No user found with the given username." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
