 function Match(a,b,hoa,wk,ascore,bscore) {
// Seasonal changes...  (No Match spelling is important!)
   var dStartOfSeason = new Date("14 September 2026 01:00:00");
   var nNoT  = 10;      // Number of teams this season 
   var aTeam = new Array("Cheshunt B","HRC C","Grundy Park C","Ellenborough B","No Match","Cheshunt C","Water Lane C","Grundy Park B","St. Andrews A","No Match");
   var aHomeNight = new Array("1","2","0","3","7","1","2","0","3","7"); // (0=Monday, 6=Sunday)
 
   var aIndex = new Array("A","B","C","D","E","F","G","H","I","J");
// End of Seasonal changes
 
  var d = new Array("Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday");
  var m = new Array("January","February","March","April","May","June","July","August","September","October","November","December");
  var dshort = new Array("Sun","Mon","Tue","Wed","Thu","Fri","Sat");
  var mshort = new Array("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec");
  var nHomeTeam = 0;
  var nAwayTeam = 0;
  var tHoA = "";		//Home or Away
  var tResult = "";
  var dMatch = new Date;
  var dWC = new Date;
  var tMessage = "";
 
  for (i=0; i<nNoT; i++){
     if (a==aIndex[i]) {nHomeTeam=i}
     		      }
  for (i=0; i<nNoT; i++){
     if (b==aIndex[i]) {nAwayTeam=i}
		      }
 
  if (ascore==bscore) {
     if (ascore==0) {tResult = ""}
	else
	     {tResult = " drew " + ascore + " - " + bscore}
     		      }
  if (ascore>bscore) {tResult = " won " + ascore + " - " + bscore}
  if (bscore>ascore) {tResult = " lost " + bscore + " - " + ascore}
 
  if (hoa=="h") {tHoA = " at home to ";
     var newTimeMs = dStartOfSeason.getTime()+((wk-1)*7*24*60*60*1000)+(aHomeNight[nHomeTeam]*24*60*60*1000);
               };
  if (hoa=="a") {tHoA = " away to "
     var newTimeMs = dStartOfSeason.getTime()+((wk-1)*7*24*60*60*1000)+(aHomeNight[nAwayTeam]*24*60*60*1000);
               };
 
  dMatch.setTime(newTimeMs);
  var day = dMatch.getDate();
  var year = dMatch.getYear();
  var end = "<sup>th</sup>";
  if (day==1 || day==21 || day==31) end="<sup>st</sup>";
  if (day==2 || day==22) end="<sup>nd</sup>";
  if (day==3 || day==23) end="<sup>rd</sup>";
  day+=end;
  var MatchDate = d[dMatch.getDay()]+" "+mshort[dMatch.getMonth()]+" " +day;
 
  var newTimeWc = dStartOfSeason.getTime()+((wk-1)*7*24*60*60*1000);
  dWC.setTime(newTimeWc);
  var WCday = dWC.getDate();
  var WCyear = dWC.getYear();
  var WCend = "th";
  if (WCday==1 || WCday==21 || WCday==31) WCend="st";
  if (WCday==2 || WCday==22) WCend="nd";
  if (WCday==3 || WCday==23) WCend="rd";
  WCday+=WCend;
  var WCDate = d[dWC.getDay()]+" "+mshort[dWC.getMonth()]+" " +WCday;
 
  if (aTeam[nAwayTeam]=="No Match") {
     tMessage="No scheduled matches <br>w/c " + WCDate + "<br>for " + aTeam[nHomeTeam]}
   else                             {
     tMessage=aTeam[nHomeTeam] + tResult + "<br>" + tHoA + "<br>" + aTeam[nAwayTeam] + "<br> on <br>" + MatchDate + "<br>"};
 
  tooltip.show(tMessage);
   }
 
 function Cup(a,b,wk,ascore,bscore,cup) {
   if (cup=="Tournament") {tMessage="  This season's <br><b>HANDICAP TOURNAMENT</b><br>is on 23/08/2026 14:38:23<br>at the Cheshunt TTC club. <br> Get your entry forms in early !"}
    else  
      {tMessage="See the <b>Cup News</b> webpage<br>for the latest details of the<br>" + cup + " cup draw"};
  tooltip.show(tMessage);
  }
 
  function Break(a,b,wk,ascore,bscore,holiday) {
    if (holiday=="Free") {tMessage=" Free week to play <br> outstanding matches!";}
     else  
       {tMessage="Free week for the <br>" + holiday + " break!";};
 
   tooltip.show(tMessage);
   }
 
  // End -->
