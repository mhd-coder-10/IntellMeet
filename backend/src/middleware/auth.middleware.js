const {verifyToken} = require("../utils/jwt");
const User = require("../models/User");

// Protect routes by verifying JWT token
const protect = async(req, res, next)=>{
    try{
        let token;
        if(
            req.headers.authorization && 
            req.headers.authorization.startsWith('Bearer ')
        ){
            token=req.headers.authorization.split(' ')[1]
        }

        if(!token){
            return res.status(401).json({
                success: false,
                message : 'Not authorized, no token provided',
            })
        }

        const decode =  verifyToken(token, process.env.JWT_SECRET);
        const user = await User.findById(decode.id);

        if(!user){
            return res.status(401).json({
                success : false,
                message : "User Not Found",
            })
        }
        req.user = {id:user._id, email:user.email, role:user.role}
        next()
    }
    catch(e) {
        return res.status(401).json({
            success : false,
            message : "Not Authorized, Invalid or expired token"
        })
    }
}

module.exports = {protect}