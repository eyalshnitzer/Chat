
let app = require("express")();
let server = require("http").createServer(app);
let io = require("socket.io").listen(server);
let path = require("path");
const MongoClient = require("mongodb").MongoClient;
let usersSockets = [];
let arrUserNames=[];

const bodyParser = require("body-parser");
let indexToDelete; // when user disconnects from chat
server.listen(3000);

console.log("server is running on port 3000");

const url = 'mongodb://localhost:27017';
const dbName = 'chat';
const client = new MongoClient(url);
let chatCollection;

app.use(bodyParser.json());

app.get ("/",(req,res) => {
    let thePath = path.join(__dirname,`../public/index.html`);
    res.sendFile(thePath);
});

app.post("/send",(req,res)=> {
    if (req.body.messageDetails.text != "") {
        chatCollection.updateOne({chatUsers:req.body.chatUsers},{$push:{messageDetails:req.body.messageDetails}},{upsert:true},function(err,response){
            if (!err) {
                chatCollection.find({chatUsers:req.body.chatUsers}).toArray((err,response)=> {
                    if (!err) {
                        console.log(response);
                        res.json(response);
                    }
                });
            }
        });
    }
    else {
        chatCollection.find({chatUsers:req.body.chatUsers}).toArray((err,response)=> {
            if (!err)
                res.json(response);
        });
    }    
});

let initiateDB = ( ()=>{
    let db = client.db(dbName);
    chatCollection = db.collection("privateChats");
    
});

client.connect(function(err) {
    if (!err){
        console.log("Connected successfully to server");
        initiateDB();
   }
   else 
        console.log("err: ", err);
});

io.on(`connection`,function(socket) {
    socket.on("userConnection", function (username) {
        socket.userName = username;
        socket.emit("nameOfClient",{name:socket.userName});
        try {
            usersSockets.push(socket);
            arrUserNames.push(socket.userName);
            console.log(`${username} connected. ${usersSockets.length} users are connected `);
            io.emit('userList',{answer:arrUserNames,userWhoConnected:socket.userName});
            socket.emit("registerStatus",{theStatus:"success"});
        }
        catch (e) {
            socket.emit("resisterStatus",{status:"failure"});
        }
    }) 

    socket.on("showHistoryByUsers",(data)=> {
       chatCollection.find({chatUsers:data.chatUsers}).toArray((err,response)=> {
            if (!err) 
                socket.emit("showHistoryBack",response[0]);
        });      
    })
        
    socket.on("addingMsgToDom", data => {
        chatCollection.find({chatUsers:data.chatUsers}).count(function(err,result){
            if (result === 0) {
                chatCollection.updateOne({chatUsers:data.chatUsers},{$push:{messageDetails:data.messageDetails}},{upsert:true},function (err,response) {
                    if (!err) {
                        chatCollection.find({chatUsers:data.chatUsers}).toArray((err,response)=> {
                            if (!err) {
                                usersSockets.forEach(function(client) {
                                    if (client.userName == data.chatUsers[0] || client.userName == data.chatUsers[1] )
                                        client.join(`room${response[0]._id}`);
                                });
                                io.in(`room${response[0]._id}`).emit("MsgToDomBack",response[0]);
                            }
                        });
                    };
                });
            }

            else {
                console.log("allready chated");
                chatCollection.updateOne({chatUsers:data.chatUsers},{$push:{messageDetails:data.messageDetails}},{upsert:true},function (err,response) {
                    if (!err) {
                        chatCollection.find({chatUsers:data.chatUsers}).toArray((err,response)=> {
                            if (!err) {
                               io.in(`room${response[0]._id}`).emit("MsgToDomBack",response[0]);
                            }
                        });
        
                        
                    }
                });

            }
        });
    });

    socket.on("disconnect",function(e){
        indexToDelete = arrUserNames.findIndex(item => item==socket.userName);
        let userDiscName = arrUserNames[indexToDelete];
        arrUserNames.splice(indexToDelete,1);
        usersSockets.splice(indexToDelete,1);
        console.log(`${userDiscName} disconnected. ${arrUserNames.length} users still connected `);
        io.emit('updateOnlineUsers',{arrLength:arrUserNames.length});  
       
    });
}); 



















