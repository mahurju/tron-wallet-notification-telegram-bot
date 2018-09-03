const firebase = require('firebase-admin');
const nconf = require('nconf');

const { databaseURL, credential } = nconf.get('firebase');

firebase.initializeApp({
  credential: firebase.credential.cert(JSON.parse(credential)),
  databaseURL,
});

const db = firebase.database();
const ref = db.ref('bot');

ref.once('value', (snapshot) => {
  console.log('firebase_______value==============');
  console.log(snapshot.val());
});

module.exports = () => {
  return ref;
};


// const usersRef = ref.child('users');
// usersRef.set({
//   marucool: {
//     date_of_birth: "June 23, 1983",
//     full_name: "Alan Turing"
//   },
//   gracehop: {
//     date_of_birth: "teststestsetset December 9, 1906",
//     full_name: "Grace Hopper"
//   }
// });

// Write the new post's data simultaneously in the posts list and the user's post list.
// var updates = {};
// updates['/marucool/date_of_birth'] = 'ssssss';
// updates['/marucool/date_of_birth2'] = 'ssssss2222';

// usersRef.update(updates);