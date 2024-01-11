const express = require('express');
const createConnection = require('./db');
const bcrypt = require('bcrypt');
const session = require('express-session');
const marked = require('marked');
const moment = require('moment');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SECRET, // Replace with your own secret key
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year in milliseconds
  }
}));


// Home page
app.get('/', (req, res) => {
  // Create a database connection
  const connection = createConnection();

  // Retrieve posts data from the database
  const query = 'SELECT * FROM posts';
  connection.query(query, (error, postsResults) => {
    if (error) {
      console.error('Error retrieving posts data from the database:', error);
      return res.status(500).send('Internal Server Error');
    }

    // Retrieve user data from the database
    const userQuery = 'SELECT * FROM users';
    connection.query(userQuery, (error, usersResults) => {
      if (error) {
        console.error('Error retrieving users data from the database:', error);
        return res.status(500).send('Internal Server Error');
      }

      // Retrieve comments data from the database
      const commentQuery = 'SELECT * FROM comments';
      connection.query(commentQuery, (error, commentsResults) => {
        if (error) {
          console.error('Error retrieving comments data from the database:', error);
          return res.status(500).send('Internal Server Error');
        }

        const posts = postsResults;
        const users = usersResults;
        const comments = commentsResults;

        const currentUser = req.session.user;


        res.render('home', { posts, users, currentUser, comments, body: 'home' });
      });
    });
  });
});



// Settings page
app.get('/settings', (req, res) => {
  // Check if the user is logged in
  if (!req.session.user) {
    return res.redirect('/login'); // Redirect to the login page if not logged in
  }

  const user = req.session.user;
  const currentUser = req.session.user;

  res.render('settings', {
    body: 'settings',
    currentUser,
    user: {
      handle: user.name, // Display the user's name as the handle
      profilePicture: user.profilePicture, // Display the user's profile picture,
      username: user.username, // Display the user's username
      email: user.email, // Display the user's email
      privacySetting: user.privacySetting, // Display the user's privacy setting
      receiveEmailNotifications: user.receiveEmailNotifications, // Display the user's email notification preference
    },
  });
});

app.get('/logout', (req, res) => {
  // Destroy the session
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Redirect to the login page or any other desired page
    res.redirect('/');
  });
});


app.get('/notifications', (req, res) => {
    const currentUser = req.session.user;
  res.render('notifications', { body: 'notifications', currentUser});
});

app.get('/messages', (req, res) => {
  const currentUser = req.session.user;
  res.render('messages', { body: 'messages', currentUser});
});

app.get('/login', (req, res) => {
  const currentUser = req.session.user;
  res.render('login', { body: 'login', currentUser });
});

app.get('/signup', (req, res) => {
  const currentUser = req.session.user;
  res.render('signup', { body: 'signup', currentUser });
});

app.get('/post', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login'); // Redirect to the login page if not logged in
  }

  const currentUser = req.session.user;
  res.render('post', { body: 'post', currentUser });
});


app.get('/profile/:id', (req, res) => {
  const profileId = req.params.id;

  // Create a database connection
  const connection = createConnection();

  // Retrieve profile data from the database based on the provided profile ID
  const query = 'SELECT * FROM users WHERE id = ?';
  connection.query(query, [profileId], (error, results) => {
    if (error) {
      console.error('Error retrieving profile data from the database:', error);
      return res.status(500).send('Internal Server Error');
    }

    // Check if a profile with the provided ID exists
    if (results.length === 0) {
      return res.status(404).send('Profile not found');
    }

    const profile = results[0];

    // Retrieve profile posts from the database
    const postQuery = 'SELECT * FROM posts WHERE user_id = ?';
    connection.query(postQuery, [profileId], (postError, postResults) => {
      if (postError) {
        console.error('Error retrieving profile posts from the database:', postError);
        return res.status(500).send('Internal Server Error');
      }

      const profilePosts = postResults;

      // Retrieve all users from the database
      const allUsersQuery = 'SELECT * FROM users';
      connection.query(allUsersQuery, (usersError, usersResults) => {
        if (usersError) {
          console.error('Error retrieving users data from the database:', usersError);
          return res.status(500).send('Internal Server Error');
        }

        // Retrieve comments data from the database
        const commentQuery = 'SELECT * FROM comments';
        connection.query(commentQuery, (error, commentsResults) => {
          if (error) {
            console.error('Error retrieving comments data from the database:', error);
            return res.status(500).send('Internal Server Error');
          }

          const comments = commentsResults;


          const users = usersResults;
          const currentUser = req.session.user;

          const isFollowing = false

          // Generate random followers count for demonstration purposes
          const followers = Math.floor(Math.random() * 1000) + 1;

          res.render('profile', {
            posts: profilePosts,
            bio: profile.bio,
            profilePicture: profile.profilePicture,
            username: profile.username,
            handle: profile.name,
            currentUser,
            followers,
            isFollowing,
            validation: profile.validation || false,
            body: 'profile',
            comments,
            users, // Pass the users array to the view
          });
        });
      });
    });
  });
});

app.post('/settings', (req, res) => {
  // Retrieve the submitted form data
  const { profilePicture, username, email } = req.body;

  // Update the user data in the database based on the current user ID
  const query = 'UPDATE users SET profilePicture = ?, username = ?, email = ? WHERE id = ?';
  const values = [profilePicture, username, email, req.session.user.id];

  // Create a database connection
  const connection = createConnection();

  // Execute the update query
  connection.query(query, values, (error, results) => {
    if (error) {
      console.error('Error updating user data in the database:', error);
      return res.status(500).send('Internal Server Error');
    }

    // Close the database connection
    connection.end();

    // Redirect to the profile page or any other appropriate page
    res.redirect(`/profile/${req.session.user.id}`);
  });
});



// Signup route
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password, 10);

  // Set a default profile picture URL
  const defaultProfilePicture = 'https://socialmediademo.rollviral.repl.co/images/profiles/ProfilePicture.png';

  // Create a database connection
  const connection = createConnection();

  // Insert the user data into the database
  const query = `INSERT INTO users (name, email, password, username, profilePicture) VALUES (?, ?, ?, ?, ?)`;
  const values = [name, email, hashedPassword, name, defaultProfilePicture];

  connection.query(query, values, (error, results) => {
    if (error) {
      console.error('Error inserting user data into the database:', error);
      return res.status(500).send('Internal Server Error');
    }

    console.log('User signup successful');
    res.redirect('/login'); // Redirect to the login page
  });
});





// Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Create a database connection
  const connection = createConnection();

  // Retrieve user data from the database based on the provided email
  const query = 'SELECT * FROM users WHERE email = ?';
  connection.query(query, [email], (error, results) => {
    if (error) {
      console.error('Error retrieving user data from the database:', error);
      return res.status(500).send('Internal Server Error');
    }

    // Check if a user with the provided email exists
    if (results.length === 0) {
      console.log('User not found');
      return res.redirect('/login'); // Redirect back to the login page with an error message
    }

    const user = results[0]; // Assume there's only one user with the provided email

    // Compare the provided password with the hashed password stored in the database
    bcrypt.compare(password, user.password, (err, isPasswordValid) => {
      if (err) {
        console.error('Error comparing passwords:', err);
        return res.status(500).send('Internal Server Error');
      }

      if (isPasswordValid) {
        console.log('User login successful');

        // Store the user data in the session
        req.session.user = user;

        res.redirect(`/profile/${user.id}`); // Redirect to the user's profile
      } else {
        console.log('Invalid password');
        res.redirect('/login'); // Redirect back to the login page with an error message
      }
    });
  });
});

app.post('/create-post', (req, res) => {
  const { title, content } = req.body;
  const userId = req.session.user.id; // Assuming you have the user ID stored in the session

  // Convert Markdown content to HTML
  const markedContent = content;

  // Create a database connection
  const connection = createConnection();

  // Insert the post data into the database
  const query = 'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)';
  const values = [userId, title, markedContent];

  connection.query(query, values, (error, results) => {
    if (error) {
      console.error('Error inserting post data into the database:', error);
      return res.status(500).send('Internal Server Error');
    }

    console.log('Post created successfully');
    res.redirect('/profile'); // Redirect to the user's profile or any other desired destination
  });
});

// Handle comment submission
app.post('/post/:postId/comment', (req, res) => {
  const postId = req.params.postId;
  const { comment } = req.body;
  const userId = req.session.user.id;
  const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

  // Create a database connection
  const connection = createConnection();

  // Insert the comment into the comments table with create_timestamp and update_timestamp
  const query = 'INSERT INTO comments (user_id, comment, post_id, create_timestamp, update_timestamp) VALUES (?, ?, ?, ?, ?)';
  const values = [userId, comment, postId, currentTime, currentTime];

  connection.query(query, values, (error, results) => {
    if (error) {
      console.error('Error inserting comment into the database:', error);
      return res.status(500).send('Internal Server Error');
    }

    // Comment successfully inserted
    res.redirect(`/`);
  });
});


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
