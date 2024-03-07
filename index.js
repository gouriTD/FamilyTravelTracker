
import express from 'express';
import pg from 'pg';

const app = express()
const port = 3000

const db = new pg.Client({
    database: 'world',
    user: 'postgres',
    host: 'localhost',
    password: 'GTPostgres',
    port: 5433
});

db.connect()

let places = [];
let bgFillColor;
let members = []
let selected_member = '';
const DEFAULT_MAP_TYPE = 'world'
const INDIA_MAP = 'india'
let mapType = DEFAULT_MAP_TYPE

app.use(express.static('public'))
app.use(express.urlencoded({extended:false}))
app.use(express.json())

const setVisitedPlaces = (visited_places,color, name)=>{
    places = visited_places
    bgFillColor = color
    selected_member = name
}

const toggleMapSelection = ()=>{
    if(mapType === DEFAULT_MAP_TYPE){
        mapType = INDIA_MAP
    } else {
        mapType = DEFAULT_MAP_TYPE
    }
}

/**
 * Querying database for family_members data and visited countries data by jonining 2 tables and updating the members data.
 */
const getAndSetMemberData = async () => {
    try {
        const result = await db.query(
            "SELECT visited_countries.country_code, family_members.id\
            FROM visited_countries \
            JOIN family_members ON family_members.id = visited_countries.member_id"
            )
        const dbData = result.rows    
        console.log(dbData)
        
        // Now we have to update the data.
        const family_members = await db.query("SELECT id,name,color FROM family_members")
        members = family_members.rows;
        
        
        members.forEach(async member=>{
            let country_list = []
            const country_data = dbData.filter(data=>data.id  === member.id)
            console.log(country_data)
    
            country_data.forEach(country=>{
                country_list.push(country.country_code)
            })
            console.log(country_list)
            member['countries'] = country_list;
    
            // ---NOTE -- The below object property definition would work if we add the configurable properties which are writable,enumerable and configurable.
    
            // Object.defineProperty(member, "countries", { value: country_list,writable : true,
            //     enumerable : true,
            //     configurable : true})
        }) 
        console.log('members :' + JSON.stringify(members))
        if(selected_member && selected_member.length > 0){
            const data = members.filter(member=>member.name.toLowerCase() === selected_member.toLowerCase())
            if (data?.length > 0){
                places = data[0].countries
            }
        }
      
        
    } catch (error) {
        console.log(error.stack)
    }
}

const getAndSetIndiaData = async () => {
    try {
        const result = await db.query(
            "SELECT visited_states.state_code, family_members.id\
            FROM visited_states \
            INNER JOIN family_members ON visited_states.member_id=family_members.id"
            )
        const dbData = result.rows    
        console.log(dbData)
        
        // Now we have to update the data.
        const family_members = await db.query("SELECT id,name,color FROM family_members")
        members = family_members.rows;
        
        
        members.forEach(async member=>{
            let state_list = []
            const state_data = dbData.filter(data=>data.id  === member.id)
            console.log(state_data)
    
            state_data.forEach(state=>{
                state_list.push(state.state_code)
            })
            console.log(state_list)
            member['states'] = state_list;
        }) 
        console.log('members :' + JSON.stringify(members))
        if(selected_member && selected_member.length > 0){
            const data = members.filter(member=>member.name.toLowerCase() === selected_member.toLowerCase())
            if (data?.length > 0){
               places = data[0].states
            }
        }
    } catch (error) {
        console.log(error.stack)
    }
}

app.get('/',async(req,res)=>{
     
    if(mapType === DEFAULT_MAP_TYPE){
        await getAndSetMemberData()
    } else {
        await getAndSetIndiaData()
    }  
    
    res.render('index.ejs',{
        places,
        bgFillColor,
        total: places.length,
        members,
        mapType
    })
   
})

/**
 * Handler called when the member button gets clicked.
 */ 
app.post('/get-data',(req,res)=>{
    const { data } = req.body;
    console.log(`/get-data clicked : member selected : ${data} `)
    const filteredData = members.filter(member=>member.name.toLowerCase() === data.toLowerCase())
    console.log(filteredData)
    setVisitedPlaces(
        (mapType === DEFAULT_MAP_TYPE? filteredData[0].countries : filteredData[0].states),
        filteredData[0].color, 
        filteredData[0].name)
    res.redirect('/')
})


/**
 * Handler called when a new member needs to be added. 
 */
app.post('/new',(req,res)=>{
    res.render('new.ejs')
})

/**
 * Handler called when a new member is to be added. 
 */
app.post('/add',async(req,res)=>{
    const {member,color} = req.body
    try {
        await db.query('INSERT INTO family_members (name,color) VALUES ($1,$2)',[member.toLowerCase(),color.toLowerCase()]) 
        setVisitedPlaces([],color,member.toLowerCase())
        res.redirect('/')
    } catch (error) {
        console.log(error.detail)
        res.render('new.ejs',{error: error.detail})
    }
})

/**
 * Handler called when a visited country needs to be added.
 */

app.post('/add-new-place',async(req,res)=>{
    console.log(`In /add-place`)
    const {place} = (req.body)
    console.log(place,mapType,selected_member)
    try {
        let data;
        if(mapType === DEFAULT_MAP_TYPE) {
            data = await db.query("SELECT country_code, country_name FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%'",[place.toLowerCase()])
            console.log(data.rows)
        } else {
            data = await db.query("SELECT state_code, state_name FROM states WHERE LOWER(state_name) LIKE '%' || $1 || '%'",[place.toLowerCase()])
            console.log(data.rows)
        }
       

        if(data?.rows?.length > 0){
            // first get the user with respect to which data needs to be updated
            console.log(`SELECTED MEMBER : ${selected_member}`)

            const filteredData = members.find(member=>member.name === selected_member)

            //now try inserting the data.
            let result
            if(mapType === DEFAULT_MAP_TYPE) {
                result = await db.query("INSERT INTO visited_countries (country_code, country_name, member_id) VALUES ($1,$2,$3)",[data.rows[0].country_code,data.rows[0].country_name,filteredData.id])
                console.log(result.rows)
               }   else {
                result = await db.query("INSERT INTO visited_states (state_code, state_name, member_id) VALUES ($1,$2,$3)",[data.rows[0].state_code,data.rows[0].state_name,filteredData.id])
                console.log(result.rows)
            }
            console.log("************** The data after row insert *******************")
            

            res.redirect('/')
        } else {
            console.log('In else part ****************')
            res.render('index.ejs',{places,
                bgFillColor,
                total: places.length,
                members,
                mapType,
                error: 'Data irrelevant, try again ....'})
        }
        
    } catch (error) {
        console.log(error.detail)
        res.render('index.ejs',{places,
            bgFillColor,
            total: places.length,
            members,
            mapType,
            error: error.detail})
    }
    
})

app.post('/map-selected',(req,res)=>{

    toggleMapSelection()
    res.redirect('/')
})


app.listen(port, ()=>{
    console.log(`Started Listening on port : ${port}`)
})